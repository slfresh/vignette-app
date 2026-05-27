"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { RouteAnalysisResult, CountryCode } from "@/types/vignette";

interface AlternativeRoutesPanelProps {
  currentResult: RouteAnalysisResult;
  onRequestAlternative: (avoidTolls: boolean) => Promise<RouteAnalysisResult | null>;
  currentAvoidsTolls: boolean;
}

interface RouteComparisonData {
  label: string;
  distance: number;
  tollCost: number;
  vignetteCost: number;
  totalCost: number;
  avoidsTolls: boolean;
}

function extractComparison(result: RouteAnalysisResult, label: string, avoidsTolls: boolean): RouteComparisonData {
  return {
    label,
    distance: result.tripEstimate?.totalDistanceKm ?? 0,
    tollCost: result.tripEstimate?.sectionTollEstimateEur ?? 0,
    vignetteCost: result.tripEstimate?.vignetteEstimateEur ?? 0,
    totalCost: result.tripEstimate?.totalRoadChargesEur ?? 0,
    avoidsTolls,
  };
}

export const AlternativeRoutesPanel = memo(function AlternativeRoutesPanel({
  currentResult,
  onRequestAlternative,
  currentAvoidsTolls,
}: AlternativeRoutesPanelProps) {
  const { t } = useI18n();
  const [alternative, setAlternative] = useState<RouteComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

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

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      handleFetchAlternative();
    }
  }, [handleFetchAlternative]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <div className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
          {t("results.compareRoutes")}
        </h3>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Calculating alternative route...
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center justify-between">
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
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RouteCard data={currentData} isCurrent />
              <RouteCard data={alternative} isCurrent={false} />
            </div>

            {/* Savings banner */}
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              {(() => {
                const costDiff = Math.abs(currentData.totalCost - alternative.totalCost);
                const distDiff = Math.abs(currentData.distance - alternative.distance);
                const cheaperRoute = currentData.totalCost <= alternative.totalCost ? currentData : alternative;

                if (costDiff < 1) {
                  return (
                    <p className="text-sm italic text-emerald-800">
                      Both routes have similar costs. Choose based on driving preference.
                    </p>
                  );
                }

                return (
                  <p className="text-sm italic text-emerald-800">
                    {cheaperRoute.label} saves{" "}
                    <strong className="font-[family-name:var(--font-mono)]">{costDiff.toFixed(2)} EUR</strong> in tolls
                    {distDiff > 5 && (
                      <>, but adds <strong className="font-[family-name:var(--font-mono)]">{distDiff.toFixed(0)} km</strong> to your journey</>
                    )}
                  </p>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </section>
  );
});

function RouteCard({ data, isCurrent }: { data: RouteComparisonData; isCurrent: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${
      isCurrent
        ? "border-[var(--accent)] bg-[#1a1a1f] text-white"
        : "border-[var(--border)] bg-surface-muted"
    }`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? "text-white/60" : "text-[var(--text-muted)]"}`}>
        {data.label}
        {isCurrent && <span className="ml-1.5 text-[var(--accent)]">(Selected)</span>}
      </p>

      <div className="mt-3 space-y-1.5 text-sm">
        <Row label="Distance" value={`${data.distance.toFixed(0)} km`} isCurrent={isCurrent} />
        <Row label="Vignettes" value={`${data.vignetteCost.toFixed(2)} EUR`} isCurrent={isCurrent} accent />
        <Row label="Section tolls" value={`${data.tollCost.toFixed(2)} EUR`} isCurrent={isCurrent} accent />
        <div className={`flex justify-between border-t pt-1.5 ${isCurrent ? "border-white/10" : "border-[var(--border)]"}`}>
          <span className={`font-medium ${isCurrent ? "text-white/70" : "text-[var(--text-secondary)]"}`}>Road charges</span>
          <span className={`font-[family-name:var(--font-mono)] font-bold ${isCurrent ? "text-white" : "text-[var(--text-primary)]"}`}>{data.totalCost.toFixed(2)} EUR</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, isCurrent, accent }: { label: string; value: string; isCurrent: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={isCurrent ? "text-white/50" : "text-[var(--text-muted)]"}>{label}</span>
      <span className={`font-[family-name:var(--font-mono)] font-medium ${
        accent
          ? isCurrent ? "text-[var(--accent-green)]" : "text-[var(--accent-green)]"
          : isCurrent ? "text-white" : "text-[var(--text-secondary)]"
      }`}>{value}</span>
    </div>
  );
}
