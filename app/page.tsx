"use client";

import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { useI18n } from "@/components/i18n/I18nProvider";
import { RouteForm } from "@/components/route/RouteForm";
import { AppliedPreferencesBanner } from "@/components/results/AppliedPreferencesBanner";
import { ComplianceBadge } from "@/components/results/ComplianceBadge";
import { BRAND } from "@/lib/config/branding";
import { MonetizationPanel } from "@/components/results/MonetizationPanel";
import { RouteCountrySummary } from "@/components/results/RouteCountrySummary";
import { SectionTollAlert } from "@/components/results/SectionTollAlert";
import { TripCostSummary } from "@/components/results/TripCostSummary";
import { TripReadinessPanel } from "@/components/results/TripReadinessPanel";
import { TripShieldPanel } from "@/components/results/TripShieldPanel";
import { VignetteResultCard } from "@/components/results/VignetteResultCard";
import type { CountryCode, EmissionClass, PowertrainType, RouteAnalysisResult, VehicleClass } from "@/types/vignette";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const MapClient = dynamic(() => import("@/components/map/MapClient").then((mod) => mod.MapClient), {
  ssr: false,
});

export default function Home() {
  const { t } = useI18n();
  const [result, setResult] = useState<RouteAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [stickyTopPx, setStickyTopPx] = useState(16);
  const [hoveredCountryCode, setHoveredCountryCode] = useState<CountryCode | null>(null);
  const [lockedCountryCode, setLockedCountryCode] = useState<CountryCode | null>(null);

  async function submitRoute(payload: {
    start: string;
    end: string;
    startPoint?: { lat: number; lon: number };
    endPoint?: { lat: number; lon: number };
    dateISO?: string;
    seats?: number;
    vehicleClass?: VehicleClass;
    powertrainType?: PowertrainType;
    grossWeightKg?: number;
    axles?: number;
    emissionClass?: EmissionClass;
    avoidTolls?: boolean;
    channelCrossingPreference?: "auto" | "ferry" | "tunnel";
  }) {
    setError(null);
    setResult(null);
    setHoveredCountryCode(null);
    setLockedCountryCode(null);
    const response = await fetch("/api/route-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Could not calculate route.");
    }

    const data = (await response.json()) as RouteAnalysisResult;
    setResult(data);
  }

  const estimatedSavingsEuro = useMemo(() => {
    if (!result) {
      return 0;
    }
    const requiredCountries = result.countries.filter((country) => country.requiresVignette).length;
    return requiredCountries * 8.5;
  }, [result]);
  const activeCountryCode = lockedCountryCode ?? hoveredCountryCode;
  const highlightedSegments = useMemo(() => {
    if (!result || !activeCountryCode) {
      return [];
    }
    const selected = result.countries.find((country) => country.countryCode === activeCountryCode);
    return selected?.routeSegments ?? [];
  }, [result, activeCountryCode]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const updateOffset = () => {
      const height = header.getBoundingClientRect().height;
      setStickyTopPx(Math.max(16, Math.round(height + 16)));
    };

    updateOffset();
    const observer = new ResizeObserver(() => updateOffset());
    observer.observe(header);
    window.addEventListener("resize", updateOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header ref={headerRef} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">{t("header.unofficial")}</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{BRAND.name}</h1>
        <p className="mt-1 text-sm font-medium text-zinc-700">{t("header.subtitle")}</p>
        <p className="mt-2 text-sm text-zinc-700">{t("header.tagline")}</p>
      </header>

      <RouteForm
        onSubmit={async (payload) => {
          try {
            await submitRoute(payload);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
            throw submitError;
          }
        }}
      />

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <section className="grid gap-4">
          <AppliedPreferencesBanner result={result} />
          <TripShieldPanel tripShield={result.tripShield} routeCountries={result.countries.map((country) => country.countryCode)} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:items-start">
            <div className="grid gap-4">
              <TripReadinessPanel result={result} />
              <TripCostSummary result={result} />
              <SectionTollAlert notices={result.sectionTolls} />
              <div className="grid gap-4 md:grid-cols-2">
                {result.countries.map((country) => (
                  <VignetteResultCard
                    key={country.countryCode}
                    country={country}
                    vehicleClass={result.appliedPreferences?.vehicleClass ?? "PASSENGER_CAR_M1"}
                    powertrainType={result.appliedPreferences?.powertrainType ?? "PETROL"}
                    highlighted={activeCountryCode === country.countryCode}
                    onHover={(code) => setHoveredCountryCode(code)}
                    onToggleLock={(code) => {
                      setLockedCountryCode((previous) => (previous === code ? null : code));
                    }}
                  />
                ))}
              </div>
              <MonetizationPanel estimatedSavingsEuro={estimatedSavingsEuro} />
              <ComplianceBadge compliance={result.compliance} />
            </div>

            <aside className="grid gap-4 xl:sticky" style={{ top: `${stickyTopPx}px` }}>
              <RouteCountrySummary countries={result.countries} />
              <MapClient
                coordinates={result.routeGeoJson.coordinates}
                highlightedCountryCode={activeCountryCode}
                highlightedSegments={highlightedSegments}
              />
            </aside>
          </div>
        </section>
      ) : null}

      <ConsentBanner />
    </main>
  );
}
