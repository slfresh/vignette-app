"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ConfidenceBadge } from "@/components/results/ConfidenceBadge";
import { getLocalizedCountryName } from "@/lib/i18n/localizedCountryName";
import type { RouteAnalysisResult } from "@/types/vignette";

interface BudgetHeroProps {
  result: RouteAnalysisResult;
  startLabel: string;
  endLabel: string;
  calculatedAt: number;
}

export function BudgetHero({ result, startLabel, endLabel, calculatedAt }: BudgetHeroProps) {
  const { t, locale } = useI18n();
  const est = result.tripEstimate;
  const readiness = result.tripReadiness;
  const countries = result.countries;
  const durationSec = result.estimatedDurationSeconds ?? 0;

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
        .format(new Date(calculatedAt))
        .toUpperCase(),
    [calculatedAt, locale],
  );

  const confidence = readiness?.confidenceScore ?? 0;
  const reasonKeys = readiness?.confidenceReasonKeys ?? [];

  const energyCost = est
    ? est.powertrain === "electric"
      ? est.electric?.estimatedChargingCostEur
      : est.fuel?.estimatedFuelCostEur
    : undefined;

  const totalTripCost =
    est && energyCost !== undefined ? est.totalRoadChargesEur + energyCost : undefined;

  const { durationLabel, etaLabel } = useMemo(() => {
    if (durationSec <= 0) return { durationLabel: null, etaLabel: null };
    const durationHours = Math.floor(durationSec / 3600);
    const durationMinutes = Math.round((durationSec % 3600) / 60);
    const etaDate = new Date(calculatedAt + durationSec * 1000);
    const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      durationLabel: `${durationHours}h ${durationMinutes}m`,
      etaLabel: fmt.format(etaDate),
    };
  }, [durationSec, calculatedAt, locale]);

  const journeyParts = t("results.journeyBreakdown").split("{accent}");

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        {t("results.routeCalculated")} · {dateLabel}
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        {journeyParts[0]}
        <em className="not-italic text-[var(--accent)]">{t("results.journeyBreakdownAccent")}</em>
        <br />
        {journeyParts[1]}
      </h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {countries.map((c, i) => (
            <span key={c.countryCode}>
              {i > 0 && <span className="mx-1.5 text-[var(--text-muted)]">→</span>}
              <span className="text-xs font-semibold uppercase text-[var(--text-muted)]">{c.countryCode}</span>{" "}
              {i === 0
                ? startLabel.split(",")[0]
                : i === countries.length - 1
                  ? endLabel.split(",")[0]
                  : getLocalizedCountryName(c.countryCode, locale)}
            </span>
          ))}
        </p>
        {confidence > 0 && reasonKeys.length > 0 ? (
          <ConfidenceBadge score={confidence} reasonKeys={reasonKeys} />
        ) : null}
      </div>

      {est && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-[#1a1a1f] text-white shadow-lg">
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              {t("results.estimatedRoadCharges")}
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight sm:text-6xl">
              {est.totalRoadChargesEur.toFixed(2)}
              <span className="ml-2 text-2xl font-medium text-white/60">EUR</span>
            </p>
            {totalTripCost !== undefined && (
              <p className="mt-2 text-sm text-white/70">
                {t("results.totalTripCost")}:{" "}
                <span className="font-[family-name:var(--font-mono)] font-semibold text-white">
                  {totalTripCost.toFixed(2)} EUR
                </span>
                <span className="ml-1 text-xs text-white/40">({t("results.fuelSeparate")})</span>
              </p>
            )}
            <p className="mt-2 text-xs text-white/40">{t("results.referenceOnly")}</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/5 lg:grid-cols-4">
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{t("results.vignettes")}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--accent-green)]">
                {est.vignetteEstimateEur.toFixed(2)} €
              </p>
            </div>
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{t("results.sectionTolls")}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--accent-green)]">
                {est.sectionTollEstimateEur.toFixed(2)} €
              </p>
            </div>
            {est.fuel ? (
              <div className="px-4 py-3 sm:px-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {t("results.fuelSeparate")}
                </p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-white">
                  {est.fuel.estimatedFuelCostEur.toFixed(2)} €
                </p>
              </div>
            ) : est.electric ? (
              <div className="px-4 py-3 sm:px-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {t("results.fuelSeparate")}
                </p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-white">
                  ~{est.electric.estimatedChargingCostEur.toFixed(2)} €
                </p>
              </div>
            ) : null}
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{t("results.totalDistance")}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--accent)]">
                {est.totalDistanceKm.toFixed(0)} km
              </p>
            </div>
          </div>
          {durationLabel && (
            <div className="grid grid-cols-2 gap-px bg-white/5">
              <div className="px-4 py-3 sm:px-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{t("results.drivingTime")}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-white">{durationLabel}</p>
              </div>
              {etaLabel && (
                <div className="px-4 py-3 sm:px-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{t("results.estimatedArrival")}</p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-semibold text-[var(--accent)]">{etaLabel}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
