"use client";

import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { RouteForm } from "@/components/route/RouteForm";
import { AppliedPreferencesBanner } from "@/components/results/AppliedPreferencesBanner";
import { ComplianceBadge } from "@/components/results/ComplianceBadge";
import { MonetizationPanel } from "@/components/results/MonetizationPanel";
import { RouteCountrySummary } from "@/components/results/RouteCountrySummary";
import { SectionTollAlert } from "@/components/results/SectionTollAlert";
import { VignetteResultCard } from "@/components/results/VignetteResultCard";
import type { RouteAnalysisResult, VehicleClass } from "@/types/vignette";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const MapClient = dynamic(() => import("@/components/map/MapClient").then((mod) => mod.MapClient), {
  ssr: false,
});

export default function Home() {
  const [result, setResult] = useState<RouteAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitRoute(payload: {
    start: string;
    end: string;
    startPoint?: { lat: number; lon: number };
    endPoint?: { lat: number; lon: number };
    dateISO?: string;
    seats?: number;
    vehicleClass?: VehicleClass;
    avoidTolls?: boolean;
    channelCrossingPreference?: "auto" | "ferry" | "tunnel";
  }) {
    setError(null);
    setResult(null);
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Unofficial information portal</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">European Vignette Portal</h1>
        <p className="mt-2 text-sm text-zinc-700">
          We analyze your route and only link to official government toll stores. No resale markups.
        </p>
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
          <RouteCountrySummary countries={result.countries} />
          <MapClient coordinates={result.routeGeoJson.coordinates} />
          <ComplianceBadge compliance={result.compliance} />
          <SectionTollAlert notices={result.sectionTolls} />
          <div className="grid gap-4 md:grid-cols-2">
            {result.countries.map((country) => (
              <VignetteResultCard
                key={country.countryCode}
                country={country}
                vehicleClass={result.appliedPreferences?.vehicleClass ?? "PASSENGER_CAR_M1"}
              />
            ))}
          </div>
          <MonetizationPanel estimatedSavingsEuro={estimatedSavingsEuro} />
        </section>
      ) : null}

      <ConsentBanner />
    </main>
  );
}
