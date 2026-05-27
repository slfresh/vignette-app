import { translate } from "@/lib/i18n/translate";
import { getFuelStrategyText } from "@/lib/i18n/routeContent";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { Locale, TranslationKey } from "@/lib/i18n/translations";
import type { RouteAnalysisResult } from "@/types/vignette";
function tr(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>): string {
  return translate(locale, key, vars);
}

/** Build a plain-text trip summary suitable for clipboard/share actions. */
export function buildSummaryText(result: RouteAnalysisResult, locale: Locale = "en"): string {
  const est = result.tripEstimate;
  if (!est) return "";

  const lines = [
    tr(locale, "share.totalDistance", { km: est.totalDistanceKm.toFixed(1) }),
    tr(locale, "share.vignetteEstimate", { amount: est.vignetteEstimateEur.toFixed(2) }),
    tr(locale, "share.sectionTollEstimate", { amount: est.sectionTollEstimateEur.toFixed(2) }),
    tr(locale, "share.roadChargesTotal", { amount: est.totalRoadChargesEur.toFixed(2) }),
  ];

  if (est.powertrain === "electric" && est.electric) {
    lines.push(tr(locale, "share.energyNeed", { kwh: est.electric.kwhNeeded.toFixed(1) }));
    const chargingLow = est.electric.estimatedChargingCostEur * 0.85;
    const chargingHigh = est.electric.estimatedChargingCostEur * 1.15;
    lines.push(
      tr(locale, "share.chargingEstimate", {
        amount: est.electric.estimatedChargingCostEur.toFixed(2),
        low: chargingLow.toFixed(2),
        high: chargingHigh.toFixed(2),
      }),
    );
    if (est.electric.bestChargeCountryCode) {
      lines.push(
        tr(locale, "share.bestChargingCountry", {
          country: COUNTRY_NAMES[est.electric.bestChargeCountryCode] ?? est.electric.bestChargeCountryCode,
          price: est.electric.bestChargePriceEurPerKwh?.toFixed(2) ?? "0",
        }),
      );
    }
  } else if (est.fuel) {
    lines.push(
      tr(locale, "share.fuelNeed", {
        type: est.fuel.assumedFuelType,
        liters: est.fuel.litersNeeded.toFixed(1),
      }),
    );
    lines.push(tr(locale, "share.fuelEstimate", { amount: est.fuel.estimatedFuelCostEur.toFixed(2) }));
    const strategy = getFuelStrategyText(est.fuel, locale);
    if (strategy) {
      lines.push(tr(locale, "share.fuelStrategy", { strategy }));
    } else if (est.fuel.bestTopUpCountryCode) {
      lines.push(
        tr(locale, "share.cheapestFuel", {
          country: COUNTRY_NAMES[est.fuel.bestTopUpCountryCode] ?? est.fuel.bestTopUpCountryCode,
          price: est.fuel.bestTopUpPriceEurPerLiter?.toFixed(2) ?? "0",
          km: est.fuel.estimatedRangePerFullTankKm,
        }),
      );
    }
  }
  return lines.join("\n");
}
