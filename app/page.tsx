"use client";

import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { useI18n } from "@/components/i18n/I18nProvider";
import { RouteForm, type RouteFormHandle } from "@/components/route/RouteForm";
import { useSearchParams, useRouter } from "next/navigation";
import { ComplianceBadge } from "@/components/results/ComplianceBadge";
import { BudgetHero } from "@/components/results/BudgetHero";
import { ResultsSkeleton } from "@/components/results/ResultsSkeleton";
import { TripShieldPanel } from "@/components/results/TripShieldPanel";
import { FuelStrategyPanel } from "@/components/results/FuelStrategyPanel";
import { ShareActions } from "@/components/results/ShareActions";
import { StickyTripSummary } from "@/components/results/StickyTripSummary";
import { VisualRouteTimeline } from "@/components/results/VisualRouteTimeline";
import type { RoutePoint } from "@/types/vignette";
import { BRAND } from "@/lib/config/branding";
import type { TranslationKey } from "@/lib/i18n/translations";
import { AlertTriangle, MapPin, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRouteAnalysis } from "@/hooks/useRouteAnalysis";
import { useMapOverlays } from "@/hooks/useMapOverlays";
import { parseRoutePointParams } from "@/lib/utils/routeUrl";

const UnifiedMap = dynamic(() => import("@/components/map/UnifiedMap").then((mod) => mod.UnifiedMap), {
  ssr: false,
});

const TripAssistant = dynamic(() => import("@/components/ai/TripAssistant").then((mod) => mod.TripAssistant), {
  ssr: false,
});

const RouteBriefingCard = dynamic(
  () => import("@/components/results/RouteBriefingCard").then((mod) => mod.RouteBriefingCard),
  { ssr: false },
);

const AlternativeRoutesPanel = dynamic(
  () => import("@/components/results/AlternativeRoutesPanel").then((mod) => mod.AlternativeRoutesPanel),
  { ssr: false },
);

function safeDecodeParam(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getErrorAdviceKey(code?: string): TranslationKey | null {
  switch (code) {
    case "RATE_LIMITED":
    case "ORS_RATE_LIMITED":
      return "errors.rateLimited";
    case "NO_ROUTE":
      return "errors.noRoute";
    case "NO_ROUTE_AVOID_TOLLS":
      return "errors.noRouteAvoidTolls";
    case "TIMEOUT":
      return "errors.timeout";
    case "MISSING_API_KEY":
    case "ORS_AUTH_FAILED":
      return "errors.missingApiKey";
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
  const resultsRef = useRef<HTMLElement | null>(null);
  const lastScrolledAt = useRef(0);
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
  const urlRoutePoints = useMemo(() => parseRoutePointParams(searchParams), [searchParams]);
  const { result: routeResult, loading: routeLoading, submitRoute } = route;
  useEffect(() => {
    if (!fromUrl || !toUrl || routeResult || routeLoading) return;
    submitRoute({
      start: fromUrl,
      end: toUrl,
      startPoint: urlRoutePoints.startPoint,
      endPoint: urlRoutePoints.endPoint,
    }).catch(() => {});
  }, [fromUrl, toUrl, urlRoutePoints.startPoint, urlRoutePoints.endPoint, routeResult, routeLoading, submitRoute]);

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
      if (formRef.current?.shouldSuppressAutoCalc()) {
        return;
      }
      lastAutoCalcRef.current = key;
      formRef.current?.submit();
    }, 600);
    return () => clearTimeout(timer);
  }, [formValues.startPoint, formValues.endPoint]);

  useEffect(() => {
    if (!route.result || route.calculatedAt <= 0 || route.calculatedAt === lastScrolledAt.current) return;
    lastScrolledAt.current = route.calculatedAt;
    const timer = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [route.result, route.calculatedAt]);

  const handleCountryClick = useCallback(
    (code: import("@/types/vignette").CountryCode) => {
      route.setLockedCountryCode((prev) => (prev === code ? null : code));
    },
    [route],
  );

  const errorAdviceKey = getErrorAdviceKey(route.errorCode);

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
            trafficIncidentTileUrl={overlays.trafficIncidentTileUrl}
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
            "mobile-sheet-container fixed inset-x-0 bottom-0 z-[9000] rounded-t-2xl border-t border-[var(--border)] bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.12)]",
            "transition-[max-height] duration-300 ease-out",
            mobileSheetOpen ? "max-h-[85dvh]" : "max-h-[170px]",
            /* Desktop: absolute floating card */
            "md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:z-20 md:max-h-none md:w-[420px] md:rounded-2xl md:border-0 md:bg-transparent md:shadow-none xl:w-[440px]",
          ].join(" ")}
        >
          {/* Mobile drag handle */}
          <div
            className="mobile-sheet-handle flex cursor-grab justify-center pb-1 pt-3 touch-none overscroll-none md:hidden"
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

          {!mobileSheetOpen && route.result?.tripEstimate && (
            <div className="px-4 pb-2 text-xs text-[var(--text-secondary)] md:hidden">
              <span className="font-medium">{formValues.start.split(",")[0] || "Start"}</span>
              <span className="mx-1 text-[var(--text-muted)]">→</span>
              <span className="font-medium">{formValues.end.split(",")[0] || "End"}</span>
              <span className="ml-2 font-[family-name:var(--font-mono)] text-[var(--accent)]">
                {route.result.tripEstimate.totalRoadChargesEur.toFixed(2)} EUR
              </span>
            </div>
          )}

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
              initialStartPoint={urlRoutePoints.startPoint}
              initialEndPoint={urlRoutePoints.endPoint}
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Error display */}
        {route.error ? (
          <div className="rounded-2xl border border-[var(--accent-red)]/20 bg-[#FDF2F0] p-4 shadow-sm" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent-red)]" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--accent-red)]">{route.error}</p>
                {errorAdviceKey ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t(errorAdviceKey)}</p>
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
          <>
            <StickyTripSummary estimate={route.result.tripEstimate} anchorId="route-results" />
            <section ref={resultsRef} id="route-results" className="grid gap-8 scroll-mt-6" aria-live="polite">
              <BudgetHero
                result={route.result}
                startLabel={formValues.start || route.result.tripReadiness?.timeline?.[0]?.label || ""}
                endLabel={formValues.end || route.result.tripReadiness?.timeline?.[route.result.tripReadiness.timeline.length - 1]?.label || ""}
                calculatedAt={route.calculatedAt}
              />

              <TripShieldPanel
                tripShield={route.result.tripShield}
                routeCountries={route.result.countries.map((c) => c.countryCode)}
                showBorderCameras={overlays.showBorderCameras}
                onShowBorderCamerasChange={overlays.setShowBorderCameras}
                hasBorderCameraData
              />

              <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
                <div className="grid gap-8">
                  <VisualRouteTimeline
                    result={route.result}
                    activeCountryCode={route.activeCountryCode}
                    onCountryHover={route.setHoveredCountryCode}
                    onCountryClick={handleCountryClick}
                  />
                  <AlternativeRoutesPanel
                    currentResult={route.result}
                    onRequestAlternative={route.fetchAlternativeRoute}
                    currentAvoidsTolls={route.result.appliedPreferences?.avoidTolls ?? false}
                  />
                </div>

                <div className="grid gap-8 xl:sticky xl:top-20 xl:self-start">
                  <RouteBriefingCard result={route.result} />
                  <FuelStrategyPanel estimate={route.result.tripEstimate} />
                  <ShareActions
                    result={route.result}
                    sharePayload={{
                      start: formValues.start,
                      end: formValues.end,
                      startPoint: formValues.startPoint,
                      endPoint: formValues.endPoint,
                    }}
                    onOpenAiChat={() => overlays.setShowAiChat(true)}
                  />
                  <ComplianceBadge compliance={route.result.compliance} />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ConsentBanner />

      {/* AI Trip Assistant FAB */}
      <button
        type="button"
        onClick={() => overlays.setShowAiChat((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition-all hover:bg-[var(--accent-hover)] hover:scale-105 active:scale-95"
        aria-label={overlays.showAiChat ? t("ai.fabClose") : t("ai.fabOpen")}
        aria-expanded={overlays.showAiChat}
        title={t("results.askAi")}
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
