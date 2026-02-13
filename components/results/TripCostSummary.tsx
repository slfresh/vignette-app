"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { EXCHANGE_RATES_LAST_UPDATED } from "@/lib/config/exchangeRates";
import { ELECTRICITY_ESTIMATES_LAST_UPDATED } from "@/lib/config/electricityEstimates";
import { FUEL_ESTIMATES_LAST_UPDATED } from "@/lib/config/fuelEstimates";
import { SECTION_TOLL_ESTIMATES_LAST_UPDATED } from "@/lib/config/sectionTollEstimates";
import type { RouteAnalysisResult } from "@/types/vignette";
import { useMemo, useState } from "react";

const COUNTRY_LABELS: Record<string, string> = {
  DE: "Germany",
  AT: "Austria",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  SI: "Slovenia",
  CH: "Switzerland",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  RS: "Serbia",
  DK: "Denmark",
  SE: "Sweden",
  NL: "Netherlands",
  BE: "Belgium",
  FR: "France",
  IT: "Italy",
  BA: "Bosnia and Herzegovina",
  ME: "Montenegro",
  XK: "Kosovo",
  MK: "North Macedonia",
  AL: "Albania",
  PL: "Poland",
  ES: "Spain",
  PT: "Portugal",
  GB: "United Kingdom",
  IE: "Ireland",
  TR: "Turkey",
  GR: "Greece",
};

function formatUpdatedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getFlagEmoji(code: string): string {
  if (code.length !== 2) {
    return "🏳️";
  }
  const base = 127397;
  const chars = code.toUpperCase().split("");
  return String.fromCodePoint(...chars.map((char) => base + char.charCodeAt(0)));
}

function formatOriginalPrice(amount: number, currency: string): string {
  if (currency === "EUR") {
    return `${amount.toFixed(2)} EUR`;
  }
  return `${amount.toLocaleString("en-US")} ${currency}`;
}

export function TripCostSummary({ result }: { result: RouteAnalysisResult }) {
  const { t } = useI18n();
  const estimate = result.tripEstimate;
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const summaryText = useMemo(() => {
    if (!estimate) {
      return "";
    }
    const lines = [
      `Total distance: ${estimate.totalDistanceKm.toFixed(1)} km`,
      `Vignette estimate: ${estimate.vignetteEstimateEur.toFixed(2)} EUR`,
      `Section toll estimate: ${estimate.sectionTollEstimateEur.toFixed(2)} EUR`,
      `Road charges total: ${estimate.totalRoadChargesEur.toFixed(2)} EUR`,
    ];
    if (estimate.powertrain === "electric" && estimate.electric) {
      lines.push(`Energy need: ${estimate.electric.kwhNeeded.toFixed(1)} kWh`);
      const chargingLow = estimate.electric.estimatedChargingCostEur * 0.85;
      const chargingHigh = estimate.electric.estimatedChargingCostEur * 1.15;
      lines.push(`Charging estimate: ~${estimate.electric.estimatedChargingCostEur.toFixed(2)} EUR (range ${chargingLow.toFixed(2)} - ${chargingHigh.toFixed(2)} EUR)`);
      if (estimate.electric.bestChargeCountryCode) {
        lines.push(
          `Best charging country: ${COUNTRY_LABELS[estimate.electric.bestChargeCountryCode]} (${estimate.electric.bestChargePriceEurPerKwh?.toFixed(2)} EUR/kWh)`,
        );
      }
    } else if (estimate.fuel) {
      lines.push(`Fuel need (${estimate.fuel.assumedFuelType}): ${estimate.fuel.litersNeeded.toFixed(1)} L`);
      lines.push(`Fuel estimate: ${estimate.fuel.estimatedFuelCostEur.toFixed(2)} EUR`);
    }
    if (estimate.fuel?.bestTopUpCountryCode) {
      lines.push(
        `Best top-up: ${COUNTRY_LABELS[estimate.fuel.bestTopUpCountryCode]} (${estimate.fuel.bestTopUpPriceEurPerLiter?.toFixed(2)} EUR/L)`,
      );
    }
    return lines.join("\n");
  }, [estimate]);
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent("Trip budget summary")}&body=${encodeURIComponent(summaryText)}`;

  async function copySummary() {
    if (!summaryText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  }

  if (!estimate) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">{t("tripBudget.title")}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((previous) => !previous)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {expanded ? t("tripBudget.hideDetails") : t("tripBudget.showDetails")}
          </button>
          <button
            type="button"
            onClick={copySummary}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t("tripBudget.copySummary")}
          </button>
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t("tripBudget.shareWhatsApp")}
          </a>
          <a href={emailShareUrl} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
            {t("tripBudget.shareEmail")}
          </a>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">{t("tripBudget.totalDistance")}: {estimate.totalDistanceKm.toFixed(1)} km</p>
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">{t("tripBudget.vignetteEstimate")}: {estimate.vignetteEstimateEur.toFixed(2)} EUR</p>
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">{t("tripBudget.sectionTollEstimate")}: {estimate.sectionTollEstimateEur.toFixed(2)} EUR</p>
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">{t("tripBudget.roadChargesTotal")}: {estimate.totalRoadChargesEur.toFixed(2)} EUR</p>
        {estimate.powertrain === "electric" && estimate.electric ? (
          <>
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">{t("tripBudget.energyNeed")}: {estimate.electric.kwhNeeded.toFixed(1)} kWh</p>
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">
              {t("tripBudget.chargingEstimate")}: ~{estimate.electric.estimatedChargingCostEur.toFixed(2)} EUR
            </p>
          </>
        ) : estimate.fuel ? (
          <>
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">
              {t("tripBudget.fuelNeed")} ({estimate.fuel.assumedFuelType}): {estimate.fuel.litersNeeded.toFixed(1)} L
            </p>
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-800">
              {t("tripBudget.fuelEstimate")}: {estimate.fuel.estimatedFuelCostEur.toFixed(2)} EUR
            </p>
          </>
        ) : null}
      </div>
      {copyState === "copied" ? <p className="mt-2 text-xs text-emerald-700">{t("tripBudget.copied")}</p> : null}
      {copyState === "error" ? <p className="mt-2 text-xs text-red-700">{t("tripBudget.copyError")}</p> : null}

      {estimate.fuel?.bestTopUpCountryCode ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t("tripBudget.bestTopUp")}: {COUNTRY_LABELS[estimate.fuel.bestTopUpCountryCode]} at about{" "}
          {estimate.fuel.bestTopUpPriceEurPerLiter?.toFixed(2)} EUR/L.
        </p>
      ) : null}
      {estimate.electric?.bestChargeCountryCode ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t("tripBudget.bestCharge")}: {COUNTRY_LABELS[estimate.electric.bestChargeCountryCode]} at about{" "}
          {estimate.electric.bestChargePriceEurPerKwh?.toFixed(2)} EUR/kWh.
        </p>
      ) : null}

      {expanded && estimate.vignetteBreakdown.length ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{t("tripBudget.vignetteByCountry")}</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-800">
            {estimate.vignetteBreakdown.map((item) => (
              <li key={`${item.countryCode}-${item.productLabel}`} className="flex items-center justify-between gap-3">
                <span>
                  {getFlagEmoji(item.countryCode)} {COUNTRY_LABELS[item.countryCode]} - {item.productLabel}
                </span>
                <span className="whitespace-nowrap">
                  {formatOriginalPrice(item.originalPrice.amount, item.originalPrice.currency)} (≈ {item.priceEur.toFixed(2)} EUR)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {expanded && estimate.sectionTollBreakdown.length ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{t("tripBudget.sectionByCountry")}</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-800">
            {estimate.sectionTollBreakdown.map((item) => (
              <li key={`section-${item.countryCode}`} className="flex items-center justify-between gap-3">
                <span>
                  {getFlagEmoji(item.countryCode)} {COUNTRY_LABELS[item.countryCode]}
                </span>
                <span className="whitespace-nowrap">≈ {item.estimatedEur.toFixed(2)} EUR</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-600">
            {t("tripBudget.sectionExplain")}
          </p>
        </div>
      ) : null}

      {expanded && estimate.fuel?.routeCountryFuelPrices.length ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{t("tripBudget.fuelComparison")}</p>
          <ul className="mt-2 grid gap-1 text-sm text-zinc-800 sm:grid-cols-2">
            {estimate.fuel.routeCountryFuelPrices.map((item) => (
              <li key={`fuel-${item.countryCode}`} className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-2 py-1">
                <span>
                  {getFlagEmoji(item.countryCode)} {COUNTRY_LABELS[item.countryCode]}
                </span>
                <span className="whitespace-nowrap">{item.priceEurPerLiter.toFixed(2)} EUR/L</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {expanded && estimate.electric?.routeCountryChargingPrices.length ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{t("tripBudget.chargingComparison")}</p>
          <ul className="mt-2 grid gap-1 text-sm text-zinc-800 sm:grid-cols-2">
            {estimate.electric.routeCountryChargingPrices.map((item) => (
              <li key={`charge-${item.countryCode}`} className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-2 py-1">
                <span>
                  {getFlagEmoji(item.countryCode)} {COUNTRY_LABELS[item.countryCode]}
                </span>
                <span className="whitespace-nowrap">{item.priceEurPerKwh.toFixed(2)} EUR/kWh</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <p className="font-semibold">{estimate.powertrain === "electric" ? t("tripBudget.chargePlan") : t("tripBudget.refuelPlan")}</p>
        {estimate.powertrain === "electric" && estimate.electric ? (
          <>
            <p className="mt-1">
              {t("tripBudget.estimatedRangeCharge")}: <span className="font-medium">{estimate.electric.estimatedRangePerFullChargeKm} km</span>.
            </p>
            {estimate.electric.suggestedChargeCountries.length ? (
              <p className="mt-1">
                {t("tripBudget.suggestedCharge")}:{" "}
                {estimate.electric.suggestedChargeCountries
                  .map((countryCode) => `${getFlagEmoji(countryCode)} ${COUNTRY_LABELS[countryCode]}`)
                  .join(" -> ")}
                .
              </p>
            ) : (
              <p className="mt-1">{t("tripBudget.oneCharge")}</p>
            )}
          </>
        ) : estimate.fuel ? (
          <>
            <p className="mt-1">
              {t("tripBudget.estimatedRangeTank")}: <span className="font-medium">{estimate.fuel.estimatedRangePerFullTankKm} km</span>.
            </p>
            {estimate.fuel.suggestedTopUpCountries.length ? (
              <p className="mt-1">
                {t("tripBudget.suggestedTopUp")}:{" "}
                {estimate.fuel.suggestedTopUpCountries
                  .map((countryCode) => `${getFlagEmoji(countryCode)} ${COUNTRY_LABELS[countryCode]}`)
                  .join(" -> ")}
                .
              </p>
            ) : (
              <p className="mt-1">{t("tripBudget.oneTank")}</p>
            )}
          </>
        ) : null}
      </div>

      {expanded && estimate.fuel?.routeCountryFuelPrices.length ? (
        <p className="mt-2 text-xs text-zinc-600">
          {t("tripBudget.fuelComparisonNote")}{" "}
          {estimate.fuel.averagePricePerLiterEur.toFixed(2)} EUR/L.
        </p>
      ) : null}
      {expanded && estimate.electric?.routeCountryChargingPrices.length ? (
        <p className="mt-2 text-xs text-zinc-600">
          {t("tripBudget.chargeComparisonNote")}{" "}
          {estimate.electric.averagePricePerKwhEur.toFixed(2)} EUR/kWh. Real charging cost can vary by network, charger type,
          weather, and subscription.
        </p>
      ) : null}

      {expanded ? (
        <>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-600">
            {estimate.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            {t("tripBudget.referenceUpdated")}: exchange rates {formatUpdatedDate(EXCHANGE_RATES_LAST_UPDATED)}, fuel prices{" "}
            {formatUpdatedDate(FUEL_ESTIMATES_LAST_UPDATED)}, charging prices {formatUpdatedDate(ELECTRICITY_ESTIMATES_LAST_UPDATED)},
            section toll references{" "}
            {formatUpdatedDate(SECTION_TOLL_ESTIMATES_LAST_UPDATED)}.
          </p>
        </>
      ) : null}
    </section>
  );
}
