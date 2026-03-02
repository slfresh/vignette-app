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
import type { CountryCode, RoutePoint } from "@/types/vignette";
import { AlertTriangle, MapPin, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRouteAnalysis } from "@/hooks/useRouteAnalysis";
import { useMapOverlays } from "@/hooks/useMapOverlays";

const UnifiedMap = dynamic(() => import("@/components/map/UnifiedMap").then((mod) => mod.UnifiedMap), {
  ssr: false,
});

const TripAssistant = dynamic(() => import("@/components/ai/TripAssistant").then((mod) => mod.TripAssistant), {
  ssr: false,
});

const AiTollExplainer = dynamic(() => import("@/components/ai/AiTollExplainer").then((mod) => mod.AiTollExplainer), {
  ssr: false,
});

import { VisualRouteTimeline } from "@/components/results/VisualRouteTimeline";
import { AlternativeRoutesPanel } from "@/components/results/AlternativeRoutesPanel";

function safeDecodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getErrorAdvice(code?: string): string | null {
  switch (code) {
    case "RATE_LIMITED":
    case "ORS_RATE_LIMITED":
      return "Too many route requests. Wait 60 seconds without clicking \u2013 repeated clicks reset the cooldown.";
    case "NO_ROUTE":
      return "The routing service could not find a path. Try more specific locations with country names.";
    case "NO_ROUTE_AVOID_TOLLS":
      return "There\u2019s no toll-free route available. Disable \u2018Avoid toll roads\u2019 to see alternatives.";
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
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-4 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </main>
  );
}

function HomeContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  const route = useRouteAnalysis(router, searchParams);
  const overlays = useMapOverlays(route.result);

  const formRef = useRef<RouteFormHandle | null>(null);
  const [formValues, setFormValues] = useState<{
    start: string;
    end: string;
    startPoint?: RoutePoint;
    endPoint?: RoutePoint;
  }>({ start: "", end: "" });

  const geo = useGeolocation();

  /* ── Mobile bottom sheet state ── */
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);

  const handleSheetPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleSheetPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    dragDelta.current = e.clientY - dragStartY.current;
  }, []);

  const handleSheetPointerUp = useCallback(() => {
    if (dragStartY.current === null) return;
    if (dragDelta.current < -40) setMobileSheetOpen(true);
    else if (dragDelta.current > 40) setMobileSheetOpen(false);
    dragStartY.current = null;
    dragDelta.current = 0;
  }, []);

  const handleSheetFocusIn = useCallback(() => {
    setMobileSheetOpen(true);
  }, []);

  const fromUrl = safeDecodeParam(searchParams.get("from"));
  const toUrl = safeDecodeParam(searchParams.get("to"));
  const { result: routeResult, loading: routeLoading, submitRoute } = route;
  useEffect(() => {
    if (!fromUrl || !toUrl || routeResult || routeLoading) return;
    submitRoute({ start: fromUrl, end: toUrl }).catch(() => {});
  }, [fromUrl, toUrl, routeResult, routeLoading, submitRoute]);

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

  /* Auto-calculate: submit form when both points are set via map pick */
  const lastAutoCalcRef = useRef<{ lat1: number; lon1: number; lat2: number; lon2: number } | null>(null);
  useEffect(() => {
    const sp = formValues.startPoint;
    const ep = formValues.endPoint;
    if (!sp || !ep) return;

    const key = { lat1: sp.lat, lon1: sp.lon, lat2: ep.lat, lon2: ep.lon };
    const prev = lastAutoCalcRef.current;
    if (prev && prev.lat1 === key.lat1 && prev.lon1 === key.lon1 && prev.lat2 === key.lat2 && prev.lon2 === key.lon2) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoCalcRef.current = key;
      formRef.current?.submit();
    }, 600);
    return () => clearTimeout(timer);
  }, [formValues.startPoint, formValues.endPoint]);

  const { setHoveredCountryCode, setLockedCountryCode } = route;

  const handleCountryHover = useCallback(
    (code: string | null) => setHoveredCountryCode(code as CountryCode | null),
    [setHoveredCountryCode],
  );

  const handleCountryLockToggle = useCallback(
    (code: string) => setLockedCountryCode((prev) => (prev === code ? null : code) as typeof prev),
    [setLockedCountryCode],
  );

  return (
    <main id="main-content" className="flex min-h-screen w-full flex-col" tabIndex={-1}>
      {/* ─── Slim Topbar ─── */}
      <header className="border-b border-[var(--border)] bg-surface px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-[var(--accent)]" strokeWidth={2.5} />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {BRAND.name}
              </h1>
              <p className="text-xs text-[var(--text-muted)]">{t("header.subtitle")}</p>
            </div>
          </div>
          <p className="hidden text-xs font-medium uppercase tracking-wider text-[var(--accent)] sm:block">
            {t("header.unofficial")}
          </p>
        </div>
      </header>

      {/* ─── Map Hero ─── */}
      <div className="relative w-full">
        {/* Map: full-height on mobile for Google Maps feel, fixed height on tablet/desktop */}
        <div className="relative isolate h-[calc(100dvh-56px)] w-full sm:h-[55vh] md:h-[65vh]">
          <UnifiedMap
            startPoint={formValues.startPoint}
            endPoint={formValues.endPoint}
            onSelectStart={handleMapSelectStart}
            onSelectDestination={handleMapSelectDest}
            routeCoordinates={route.result?.routeGeoJson.coordinates}
            highlightedCountryCode={route.activeCountryCode}
            highlightedSegments={route.highlightedSegments}
            borderCrossings={route.result?.borderCrossings}
            showBorderCameras={overlays.showBorderCameras}
            onToggleBorderCameras={overlays.setShowBorderCameras}
            hasBorderCameraData
            speedCameras={overlays.speedCameras}
            showSpeedCameras={overlays.showSpeedCameras}
            onToggleSpeedCameras={overlays.setShowSpeedCameras}
            speedCamerasAvailable={overlays.speedCamerasAvailable}
            showHighwayCameras={overlays.showHighwayCameras}
            onToggleHighwayCameras={overlays.setShowHighwayCameras}
            showTraffic={overlays.showTraffic}
            onToggleTraffic={overlays.setShowTraffic}
            trafficTileUrl={overlays.trafficTileUrl}
            geoPosition={geo.position}
            geoLoading={geo.loading}
          />
        </div>

        {/* Route form: mobile bottom sheet / desktop floating card (single instance) */}
        <div
          ref={sheetRef}
          onFocusCapture={handleSheetFocusIn}
          className={[
            /* Mobile: fixed bottom sheet */
            "fixed inset-x-0 bottom-0 z-[9000] rounded-t-2xl border-t border-[var(--border)] bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.12)]",
            "transition-[max-height] duration-300 ease-out",
            mobileSheetOpen ? "max-h-[85dvh]" : "max-h-[170px]",
            /* Desktop: absolute floating card */
            "md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:z-20 md:max-h-none md:w-[420px] md:rounded-2xl md:border-0 md:bg-transparent md:shadow-none xl:w-[440px]",
          ].join(" ")}
        >
          {/* Mobile drag handle */}
          <div
            className="flex cursor-grab justify-center pb-1 pt-3 touch-none md:hidden"
            role="button"
            tabIndex={0}
            aria-label="Expand or collapse route form"
            onClick={() => setMobileSheetOpen((prev) => !prev)}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setMobileSheetOpen((prev) => !prev); }}
          >
            <div className={`h-1.5 w-12 rounded-full transition-colors ${mobileSheetOpen ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`} />
          </div>

          {/* Scrollable on mobile when expanded, normal overflow on desktop */}
          <div
            className={[
              "mobile-sheet-form px-3 pb-4 md:px-0 md:pb-0",
              mobileSheetOpen ? "overflow-y-auto" : "overflow-hidden",
              "md:overflow-visible",
            ].join(" ")}
            style={{ maxHeight: mobileSheetOpen ? "calc(85dvh - 32px)" : undefined }}
          >
            <RouteForm
              ref={formRef}
              initialStart={fromUrl}
              initialEnd={toUrl}
              isSubmitting={route.loading}
              onValuesChange={setFormValues}
              onSubmit={async (payload) => {
                setMobileSheetOpen(false);
                await route.submitRoute(payload);
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Content below map ─── */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Error display */}
        {route.error ? (
          <div className="rounded-2xl border border-[var(--accent-red)]/20 bg-[#FDF2F0] p-4 shadow-sm" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent-red)]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--accent-red)]">{route.error}</p>
                {getErrorAdvice(route.errorCode) ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{getErrorAdvice(route.errorCode)}</p>
                ) : null}
                {(route.errorCode === "TIMEOUT" || route.errorCode === "ORS_RATE_LIMITED" || route.errorCode === "ORS_ERROR") && route.lastPayload ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (route.lastPayload) {
                        route.submitRoute(route.lastPayload).catch(() => {});
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-[var(--accent-red)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("errors.tryAgain")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Loading skeleton */}
        {route.loading && !route.result ? <ResultsSkeleton /> : null}

        {/* Results section */}
        {route.result ? (
          <section className="grid gap-6" aria-live="polite">
            <AppliedPreferencesBanner result={route.result} />

            {/* Budget Hero */}
            {route.result.tripEstimate && (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
                <div className="border-b border-[var(--border)] bg-surface-muted px-6 py-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {t("results.estimatedBudget")}
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl">
                    {route.result.tripEstimate.totalRoadChargesEur.toFixed(2)}
                    <span className="ml-2 font-[family-name:var(--font-sans)] text-2xl font-medium text-[var(--text-muted)]">EUR</span>
                  </p>
                </div>
                <div className="grid gap-2 px-6 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-surface-muted px-3 py-2">
                    <p className="text-xs text-[var(--text-muted)]">{t("results.vignettes")}</p>
                    <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">{route.result.tripEstimate.vignetteEstimateEur.toFixed(2)} EUR</p>
                  </div>
                  <div className="rounded-lg bg-surface-muted px-3 py-2">
                    <p className="text-xs text-[var(--text-muted)]">{t("results.sectionTolls")}</p>
                    <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">{route.result.tripEstimate.sectionTollEstimateEur.toFixed(2)} EUR</p>
                  </div>
                  {route.result.tripEstimate.fuel ? (
                    <div className="rounded-lg bg-surface-muted px-3 py-2">
                      <p className="text-xs text-[var(--text-muted)]">{t("results.fuelEstimate")}</p>
                      <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">~{route.result.tripEstimate.fuel.estimatedFuelCostEur.toFixed(2)} EUR</p>
                    </div>
                  ) : null}
                  {route.result.tripEstimate.electric ? (
                    <div className="rounded-lg bg-surface-muted px-3 py-2">
                      <p className="text-xs text-[var(--text-muted)]">{t("results.chargingEstimate")}</p>
                      <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">~{route.result.tripEstimate.electric.estimatedChargingCostEur.toFixed(2)} EUR</p>
                    </div>
                  ) : null}
                  <div className="rounded-lg bg-surface-muted px-3 py-2">
                    <p className="text-xs text-[var(--text-muted)]">{t("results.totalDistance")}</p>
                    <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">{route.result.tripEstimate.totalDistanceKm.toFixed(0)} km</p>
                  </div>
                </div>
              </div>
            )}

            <TripShieldPanel
              tripShield={route.result.tripShield}
              routeCountries={route.result.countries.map((c) => c.countryCode)}
              showBorderCameras={overlays.showBorderCameras}
              onShowBorderCamerasChange={overlays.setShowBorderCameras}
              hasBorderCameraData
            />

            <VisualRouteTimeline result={route.result} />
            <AiTollExplainer result={route.result} />
            <RouteCountrySummary countries={route.result.countries} onCountryClick={route.handleCountrySummaryClick} />
            <TripReadinessPanel result={route.result} />
            <TripCostSummary result={route.result} />
            <SectionTollAlert notices={route.result.sectionTolls} />

            <div className="grid gap-4 md:grid-cols-2">
              {route.result.countries.map((country, index) => {
                const isFirst = index === 0;
                const expanded = isFirst || route.activeCountryCode === country.countryCode || route.expandedCountryCodes.has(country.countryCode);
                return (
                  <div
                    key={country.countryCode}
                    ref={(el) => { route.countryCardRefs.current[country.countryCode] = el; }}
                  >
                    <VignetteResultCard
                      country={country}
                      vehicleClass={route.result!.appliedPreferences?.vehicleClass ?? "PASSENGER_CAR_M1"}
                      powertrainType={route.result!.appliedPreferences?.powertrainType ?? "PETROL"}
                      highlighted={route.activeCountryCode === country.countryCode}
                      expanded={expanded}
                      onHover={handleCountryHover}
                      onToggleLock={handleCountryLockToggle}
                      onExpandToggle={route.handleExpandToggle}
                    />
                  </div>
                );
              })}
            </div>

            <AlternativeRoutesPanel
              currentResult={route.result}
              onRequestAlternative={route.fetchAlternativeRoute}
              currentAvoidsTolls={route.result.appliedPreferences?.avoidTolls ?? false}
            />

            <MonetizationPanel estimatedSavingsEuro={route.estimatedSavingsEuro} />
            <ComplianceBadge compliance={route.result.compliance} />
          </section>
        ) : null}
      </div>

      <ConsentBanner />

      {/* AI Trip Assistant FAB */}
      <button
        type="button"
        onClick={() => overlays.setShowAiChat((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition-all hover:bg-[var(--accent-hover)] hover:scale-105 active:scale-95"
        aria-label={overlays.showAiChat ? "Close AI assistant" : "Open AI trip assistant"}
        aria-expanded={overlays.showAiChat}
        title="AI Trip Assistant"
      >
        {overlays.showAiChat ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
      <TripAssistant
        routeResult={route.result}
        isOpen={overlays.showAiChat}
        onClose={() => overlays.setShowAiChat(false)}
      />
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
