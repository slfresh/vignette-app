"use client";

import { memo, useCallback, useState } from "react";
import type { RouteAnalysisResult, CountryCode } from "@/types/vignette";

interface AlternativeRoutesPanelProps {
  currentResult: RouteAnalysisResult;
  /** The original form payload to re-submit with different options. */
  onRequestAlternative: (avoidTolls: boolean) => Promise<RouteAnalysisResult | null>;
  /** Whether the current route was calculated with avoidTolls. */
  currentAvoidsTolls: boolean;
}

const FLAG_EMOJI: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CZ: "🇨🇿", SK: "🇸🇰", HU: "🇭🇺", SI: "🇸🇮", CH: "🇨🇭", RO: "🇷🇴",
  BG: "🇧🇬", HR: "🇭🇷", RS: "🇷🇸", DK: "🇩🇰", SE: "🇸🇪", NL: "🇳🇱", BE: "🇧🇪", FR: "🇫🇷",
  IT: "🇮🇹", BA: "🇧🇦", ME: "🇲🇪", AL: "🇦🇱", PL: "🇵🇱", ES: "🇪🇸", PT: "🇵🇹", GB: "🇬🇧",
  GR: "🇬🇷", XK: "🇽🇰", MK: "🇲🇰", IE: "🇮🇪", TR: "🇹🇷",
};

interface RouteComparisonData {
  label: string;
  distance: number;
  tollCost: number;
  vignetteCost: number;
  totalCost: number;
  countries: Array<{ code: CountryCode; vignette: boolean; sectionToll: boolean }>;
  fuelCost?: number;
  avoidsTolls: boolean;
}

function extractComparison(result: RouteAnalysisResult, label: string, avoidsTolls: boolean): RouteComparisonData {
  return {
    label,
    distance: result.tripEstimate?.totalDistanceKm ?? 0,
    tollCost: result.tripEstimate?.sectionTollEstimateEur ?? 0,
    vignetteCost: result.tripEstimate?.vignetteEstimateEur ?? 0,
    totalCost: result.tripEstimate?.totalRoadChargesEur ?? 0,
    fuelCost: result.tripEstimate?.fuel?.estimatedFuelCostEur ?? result.tripEstimate?.electric?.estimatedChargingCostEur,
    countries: result.countries.map((c) => ({
      code: c.countryCode,
      vignette: c.requiresVignette,
      sectionToll: c.requiresSectionToll,
    })),
    avoidsTolls,
  };
}

/**
 * Shows a side-by-side comparison of the current route vs an
 * alternative route (toll vs toll-free).
 */
export const AlternativeRoutesPanel = memo(function AlternativeRoutesPanel({
  currentResult,
  onRequestAlternative,
  currentAvoidsTolls,
}: AlternativeRoutesPanelProps) {
  const [alternative, setAlternative] = useState<RouteComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const currentData = extractComparison(
    currentResult,
    currentAvoidsTolls ? "Toll-free route" : "Fastest route",
    currentAvoidsTolls,
  );

  const handleFetchAlternative = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const altResult = await onRequestAlternative(!currentAvoidsTolls);
      if (altResult) {
        setAlternative(
          extractComparison(
            altResult,
            currentAvoidsTolls ? "Fastest route (with tolls)" : "Toll-free route",
            !currentAvoidsTolls,
          ),
        );
      }
    } catch {
      setError("Could not calculate alternative route.");
    } finally {
      setLoading(false);
    }
  }, [onRequestAlternative, currentAvoidsTolls]);

  const handleToggle = useCallback(() => {
    const opening = !expanded;
    setExpanded(opening);
    if (opening && !alternative && !loading && !error) {
      handleFetchAlternative();
    }
  }, [expanded, alternative, loading, error, handleFetchAlternative]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-muted"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
            <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
          </svg>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Compare Routes</span>
          {!expanded && (
            <span className="text-xs text-[var(--text-muted)]">See toll vs toll-free comparison</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              Calculating alternative route...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between py-2">
              <p className="text-xs text-[var(--accent-red)]">{error}</p>
              <button
                type="button"
                onClick={handleFetchAlternative}
                className="rounded bg-surface-muted px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-background"
              >
                Retry
              </button>
            </div>
          )}

          {alternative && (
            <div className="grid gap-3 sm:grid-cols-2">
              <RouteCard data={currentData} isCurrent />
              <RouteCard data={alternative} isCurrent={false} />

              <div className="col-span-full rounded-lg bg-surface-muted p-3 text-center">
                {(() => {
                  const costDiff = Math.abs(currentData.totalCost - alternative.totalCost);
                  const distDiff = Math.abs(currentData.distance - alternative.distance);
                  const cheaperRoute = currentData.totalCost <= alternative.totalCost ? currentData : alternative;
                  const longerRoute = currentData.distance >= alternative.distance ? currentData : alternative;

                  if (costDiff < 1) {
                    return (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Both routes have similar costs. Choose based on driving preference.
                      </p>
                    );
                  }

                  return (
                    <p className="text-sm text-[var(--text-secondary)]">
                      <strong>{cheaperRoute.label}</strong> saves{" "}
                      <strong className="font-[family-name:var(--font-mono)]">{costDiff.toFixed(2)} EUR</strong> in tolls
                      {distDiff > 5 && (
                        <>, but {longerRoute.label} is <strong className="font-[family-name:var(--font-mono)]">{distDiff.toFixed(0)} km</strong> longer</>
                      )}
                      .
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
});

function RouteCard({ data, isCurrent }: { data: RouteComparisonData; isCurrent: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${isCurrent ? "border-[var(--accent)] bg-surface-muted" : "border-[var(--border)] bg-surface-muted"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--text-primary)]">{data.label}</p>
        {isCurrent && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">Current</span>
        )}
      </div>

      <div className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Distance</span>
          <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--text-secondary)]">{data.distance.toFixed(0)} km</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Vignettes</span>
          <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--text-secondary)]">{data.vignetteCost.toFixed(2)} EUR</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Section tolls</span>
          <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--text-secondary)]">{data.tollCost.toFixed(2)} EUR</span>
        </div>
        {data.fuelCost !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Fuel / charging</span>
            <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--text-secondary)]">~{data.fuelCost.toFixed(2)} EUR</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--border)] pt-1">
          <span className="font-semibold text-[var(--text-secondary)]">Road charges</span>
          <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--text-primary)]">{data.totalCost.toFixed(2)} EUR</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {data.countries.map((c) => (
          <span
            key={c.code}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              c.vignette
                ? "bg-amber-100 text-amber-800"
                : c.sectionToll
                  ? "bg-orange-100 text-orange-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}
            title={`${c.code}${c.vignette ? " (vignette)" : ""}${c.sectionToll ? " (section toll)" : ""}`}
          >
            {FLAG_EMOJI[c.code] ?? c.code}
          </span>
        ))}
      </div>
    </div>
  );
}
