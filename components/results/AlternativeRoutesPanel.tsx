"use client";

import { memo, useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { RouteAnalysisResult } from "@/types/vignette";

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
  const [expanded, setExpanded] = useState(false);

  const currentData = extractComparison(
    currentResult,
    currentAvoidsTolls ? t("compare.tollFreeRoute") : t("compare.fastestRoute"),
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
            currentAvoidsTolls ? t("compare.fastestWithTolls") : t("compare.tollFreeRoute"),
            !currentAvoidsTolls,
          ),
        );
      }
    } catch {
      setError(t("compare.couldNotCalculate"));
    } finally {
      setLoading(false);
    }
  }, [onRequestAlternative, currentAvoidsTolls, t]);

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
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
            {t("results.compareRoutes")}
          </h3>
          {!expanded && (
            <p className="text-xs text-[var(--text-muted)]">{t("compare.seeComparison")}</p>
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
          className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-5 pb-5">
          {loading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              {t("compare.calculating")}
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
                {t("compare.retry")}
              </button>
            </div>
          )}

          {(alternative || (!loading && !error)) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RouteCard data={currentData} isCurrent t={t} />
              {alternative ? <RouteCard data={alternative} isCurrent={false} t={t} /> : null}
            </div>
          )}

          {alternative && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                {(() => {
                  const costDiff = Math.abs(currentData.totalCost - alternative.totalCost);
                  const distDiff = Math.abs(currentData.distance - alternative.distance);
                  const cheaperRoute = currentData.totalCost <= alternative.totalCost ? currentData : alternative;

                  if (costDiff < 1) {
                    return <p className="text-sm italic text-emerald-800">{t("compare.similarCosts")}</p>;
                  }

                  let msg = t("compare.savesTolls")
                    .replace("{label}", cheaperRoute.label)
                    .replace("{amount}", costDiff.toFixed(2));
                  if (distDiff > 5) {
                    msg += t("compare.addsDistance").replace("{km}", distDiff.toFixed(0));
                  }
                  return <p className="text-sm italic text-emerald-800">{msg}</p>;
                })()}
              </div>
          )}
        </div>
      )}
    </section>
  );
});

function RouteCard({
  data,
  isCurrent,
  t,
}: {
  data: RouteComparisonData;
  isCurrent: boolean;
  t: (key: import("@/lib/i18n/translations").TranslationKey) => string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isCurrent ? "border-[var(--accent)] bg-[#1a1a1f] text-white" : "border-[var(--border)] bg-surface-muted"
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? "text-white/60" : "text-[var(--text-muted)]"}`}>
        {data.label}
        {isCurrent && <span className="ml-1.5 text-[var(--accent)]">{t("compare.currentSelected")}</span>}
      </p>
      <div className="mt-3 space-y-1.5 text-sm">
        <Row label={t("compare.distance")} value={`${data.distance.toFixed(0)} km`} isCurrent={isCurrent} />
        <Row label={t("compare.vignettes")} value={`${data.vignetteCost.toFixed(2)} EUR`} isCurrent={isCurrent} accent />
        <Row label={t("compare.sectionTolls")} value={`${data.tollCost.toFixed(2)} EUR`} isCurrent={isCurrent} accent />
        <div className={`flex justify-between border-t pt-1.5 ${isCurrent ? "border-white/10" : "border-[var(--border)]"}`}>
          <span className={`font-medium ${isCurrent ? "text-white/70" : "text-[var(--text-secondary)]"}`}>
            {t("compare.roadCharges")}
          </span>
          <span className={`font-[family-name:var(--font-mono)] font-bold ${isCurrent ? "text-white" : "text-[var(--text-primary)]"}`}>
            {data.totalCost.toFixed(2)} EUR
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, isCurrent, accent }: { label: string; value: string; isCurrent: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={isCurrent ? "text-white/50" : "text-[var(--text-muted)]"}>{label}</span>
      <span
        className={`font-[family-name:var(--font-mono)] font-medium ${
          accent ? "text-[var(--accent-green)]" : isCurrent ? "text-white" : "text-[var(--text-secondary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
