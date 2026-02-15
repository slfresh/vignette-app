"use client";

import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { useI18n } from "@/components/i18n/I18nProvider";
import { RouteForm, type RouteFormHandle } from "@/components/route/RouteForm";
import { useSearchParams, useRouter } from "next/navigation";
import { AppliedPreferencesBanner } from "@/components/results/AppliedPreferencesBanner";
import { ComplianceBadge } from "@/components/results/ComplianceBadge";
import { BRAND } from "@/lib/config/branding";
import { MonetizationPanel } from "@/components/results/MonetizationPanel";
import { ResultsSkeleton } from "@/components/results/ResultsSkeleton";
import { RouteCountrySummary } from "@/components/results/RouteCountrySummary";
import { SectionTollAlert } from "@/components/results/SectionTollAlert";
import { TripCostSummary } from "@/components/results/TripCostSummary";
import { TripReadinessPanel } from "@/components/results/TripReadinessPanel";
import { TripShieldPanel } from "@/components/results/TripShieldPanel";
import { VignetteResultCard } from "@/components/results/VignetteResultCard";
import type { CountryCode, EmissionClass, PowertrainType, RouteAnalysisResult, RoutePoint, VehicleClass } from "@/types/vignette";
import { AlertTriangle, RefreshCw, Route } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";

const UnifiedMap = dynamic(() => import("@/components/map/UnifiedMap").then((mod) => mod.UnifiedMap), {
  ssr: false,
});

/** Safely decode URL param – prevents %20, %2C etc. from showing in form inputs */
function safeDecodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Maps API error codes to user-friendly advice. */
function getErrorAdvice(code?: string): string | null {
  switch (code) {
    case "RATE_LIMITED":
    case "ORS_RATE_LIMITED":
      return "Too many route requests. Wait 60 seconds without clicking – repeated clicks reset the cooldown.";
    case "NO_ROUTE":
      return "The routing service could not find a path. Try more specific locations with country names.";
    case "NO_ROUTE_AVOID_TOLLS":
      return "There's no toll-free route available. Disable 'Avoid toll roads' to see alternatives.";
    case "TIMEOUT":
      return "The request took too long. This usually resolves on retry.";
    case "MISSING_API_KEY":
    case "ORS_AUTH_FAILED":
      return "This is a server configuration issue. Contact the site operator.";
    default:
      return null;
  }
}

function HomeFallback() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col items-center justify-center gap-4 px-4 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <p className="text-sm text-zinc-600">Loading...</p>
    </main>
  );
}

function HomeContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<RouteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const headerRef = useRef<HTMLElement | null>(null);
  const [stickyTopPx, setStickyTopPx] = useState(16);
  const [hoveredCountryCode, setHoveredCountryCode] = useState<CountryCode | null>(null);
  const [lockedCountryCode, setLockedCountryCode] = useState<CountryCode | null>(null);
  const [showBorderCameras, setShowBorderCameras] = useState(false);
  const [expandedCountryCodes, setExpandedCountryCodes] = useState<Set<CountryCode>>(new Set());
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);
  const countryCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const submitAbortRef = useRef<AbortController | null>(null);
  const formRef = useRef<RouteFormHandle | null>(null);
  const [formValues, setFormValues] = useState<{
    start: string;
    end: string;
    startPoint?: RoutePoint;
    endPoint?: RoutePoint;
  }>({ start: "", end: "" });

  /* Geolocation – auto-ask on load */
  const geo = useGeolocation();

  const submitRoute = useCallback(async (payload: {
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
  }) => {
    setError(null);
    setErrorCode(undefined);
    setResult(null);
    setLoading(true);
    setHoveredCountryCode(null);
    setLockedCountryCode(null);
    setShowBorderCameras(false);
    setExpandedCountryCodes(new Set());
    lastPayloadRef.current = payload as Record<string, unknown>;

    try {
      // Abort any in-flight request before starting a new one
      submitAbortRef.current?.abort();
      const abortController = new AbortController();
      submitAbortRef.current = abortController;

      const response = await fetch("/api/route-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string; code?: string };
        setErrorCode(body.code);
        throw new Error(body.error ?? "Could not calculate route.");
      }

      const data = (await response.json()) as RouteAnalysisResult;
      setResult(data);

      const fromParam = encodeURIComponent(payload.start.trim());
      const toParam = encodeURIComponent(payload.end.trim());
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("from", fromParam);
      newParams.set("to", toParam);
      router.replace(`/?${newParams.toString()}`, { scroll: false });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unexpected error occurred.";
      setError(message);
      throw submitError;
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

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

  /** Always show camera toggle – users can browse all Croatian border cameras regardless of route */
  const hasBorderCameraData = true;

  // Auto-submit when user lands with a shared URL (?from=X&to=Y)
  const fromUrl = safeDecodeParam(searchParams.get("from"));
  const toUrl = safeDecodeParam(searchParams.get("to"));
  useEffect(() => {
    if (!fromUrl || !toUrl || result || loading) return;
    submitRoute({ start: fromUrl, end: toUrl }).catch(() => {});
  }, [fromUrl, toUrl, result, loading, submitRoute]);

  const handleCountrySummaryClick = useCallback((code: CountryCode) => {
    setLockedCountryCode((prev) => (prev === code ? null : code));
    setExpandedCountryCodes((prev) => new Set(prev).add(code));
    const el = countryCardRefs.current[code];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleExpandToggle = useCallback((code: CountryCode) => {
    setExpandedCountryCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

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

  /* ── Map select handlers (fill form from map clicks) ── */
  const handleMapSelectStart = useCallback(
    (label: string, point: RoutePoint) => {
      formRef.current?.setStartFromMap(label, point);
    },
    [],
  );
  const handleMapSelectDest = useCallback(
    (label: string, point: RoutePoint) => {
      formRef.current?.setEndFromMap(label, point);
    },
    [],
  );

  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6" tabIndex={-1}>
      {/* ── Header ── */}
      <header ref={headerRef} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-4">
          <p className="text-xs font-semibold tracking-wider text-blue-100 uppercase">{t("header.unofficial")}</p>
          <h1 className="mt-1.5 inline-flex items-center gap-2.5 text-2xl font-bold text-white">
            <Route className="h-7 w-7" strokeWidth={2.5} />
            {BRAND.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/90">{t("header.subtitle")}</p>
        </div>
        <div className="px-6 py-3">
          <p className="text-sm text-zinc-600">{t("header.tagline")}</p>
        </div>
      </header>

      {/* ── Map + Form grid ──
          Mobile: Map on top (order-first), Form below
          Desktop (lg): Form left, Map right (sticky) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <RouteForm
          ref={formRef}
          initialStart={fromUrl}
          initialEnd={toUrl}
          isSubmitting={loading}
          onValuesChange={setFormValues}
          onSubmit={async (payload) => {
            await submitRoute(payload);
          }}
        />

        {/* Unified Map – always visible, transitions between input & route mode */}
        <div className="order-first lg:order-none lg:sticky" style={{ top: `${stickyTopPx}px` }}>
          <UnifiedMap
            /* Input mode props */
            startPoint={formValues.startPoint}
            endPoint={formValues.endPoint}
            onSelectStart={handleMapSelectStart}
            onSelectDestination={handleMapSelectDest}
            /* Route mode props – only passed when a route has been calculated */
            routeCoordinates={result?.routeGeoJson.coordinates}
            highlightedCountryCode={activeCountryCode}
            highlightedSegments={highlightedSegments}
            borderCrossings={result?.borderCrossings}
            showBorderCameras={showBorderCameras}
            onToggleBorderCameras={setShowBorderCameras}
            hasBorderCameraData={hasBorderCameraData}
            /* Geolocation */
            geoPosition={geo.position}
            geoLoading={geo.loading}
          />
        </div>
      </div>

      {/* ── Error display with actionable advice ── */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800">{error}</p>
              {getErrorAdvice(errorCode) ? (
                <p className="mt-1 text-xs text-red-600">{getErrorAdvice(errorCode)}</p>
              ) : null}
              {/* Retry button for transient errors */}
              {(errorCode === "TIMEOUT" || errorCode === "ORS_RATE_LIMITED" || errorCode === "ORS_ERROR") && lastPayloadRef.current ? (
                <button
                  type="button"
                  onClick={() => {
                    if (lastPayloadRef.current) {
                      submitRoute(lastPayloadRef.current as Parameters<typeof submitRoute>[0]).catch(() => {
                        // Error is already handled inside submitRoute
                      });
                    }
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Loading skeleton ── */}
      {loading && !result ? <ResultsSkeleton /> : null}

      {/* ── Results section ── */}
      {result ? (
        <section className="grid gap-6" aria-live="polite">
          <AppliedPreferencesBanner result={result} />

          {/* Budget Hero – prominent total at top */}
          {result.tripEstimate && (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Estimated total budget
                </p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {result.tripEstimate.totalRoadChargesEur.toFixed(2)}{" "}
                  <span className="text-xl font-semibold text-blue-100">EUR</span>
                </p>
              </div>
              <div className="grid gap-2 px-6 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">Vignettes</p>
                  <p className="font-semibold text-zinc-900">{result.tripEstimate.vignetteEstimateEur.toFixed(2)} EUR</p>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">Section tolls</p>
                  <p className="font-semibold text-zinc-900">{result.tripEstimate.sectionTollEstimateEur.toFixed(2)} EUR</p>
                </div>
                {result.tripEstimate.fuel ? (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">Fuel estimate</p>
                    <p className="font-semibold text-zinc-900">~{result.tripEstimate.fuel.estimatedFuelCostEur.toFixed(2)} EUR</p>
                  </div>
                ) : null}
                {result.tripEstimate.electric ? (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">Charging estimate</p>
                    <p className="font-semibold text-zinc-900">~{result.tripEstimate.electric.estimatedChargingCostEur.toFixed(2)} EUR</p>
                  </div>
                ) : null}
                <div className="rounded-lg bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">Total distance</p>
                  <p className="font-semibold text-zinc-900">{result.tripEstimate.totalDistanceKm.toFixed(0)} km</p>
                </div>
              </div>
            </div>
          )}

          <TripShieldPanel
            tripShield={result.tripShield}
            routeCountries={result.countries.map((country) => country.countryCode)}
            showBorderCameras={showBorderCameras}
            onShowBorderCamerasChange={setShowBorderCameras}
            hasBorderCameraData={hasBorderCameraData}
          />

          {/* Route summary + country cards */}
          <RouteCountrySummary countries={result.countries} onCountryClick={handleCountrySummaryClick} />

          <TripReadinessPanel result={result} />
          <TripCostSummary result={result} />
          <SectionTollAlert notices={result.sectionTolls} />

          <div className="grid gap-4 md:grid-cols-2">
            {result.countries.map((country, index) => {
              const isFirst = index === 0;
              const expanded = isFirst || activeCountryCode === country.countryCode || expandedCountryCodes.has(country.countryCode);
              return (
                <div
                  key={country.countryCode}
                  ref={(el) => { countryCardRefs.current[country.countryCode] = el; }}
                >
                  <VignetteResultCard
                    country={country}
                    vehicleClass={result.appliedPreferences?.vehicleClass ?? "PASSENGER_CAR_M1"}
                    powertrainType={result.appliedPreferences?.powertrainType ?? "PETROL"}
                    highlighted={activeCountryCode === country.countryCode}
                    expanded={expanded}
                    onHover={(code) => setHoveredCountryCode(code)}
                    onToggleLock={(code) => {
                      setLockedCountryCode((previous) => (previous === code ? null : code));
                    }}
                    onExpandToggle={handleExpandToggle}
                  />
                </div>
              );
            })}
          </div>

          <MonetizationPanel estimatedSavingsEuro={estimatedSavingsEuro} />
          <ComplianceBadge compliance={result.compliance} />
        </section>
      ) : null}

      <ConsentBanner />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}
