import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { RouteAnalysisResult } from "@/types/vignette";

/** Build a plain-text trip summary suitable for clipboard/share actions. */
export function buildSummaryText(result: RouteAnalysisResult): string {
  const est = result.tripEstimate;
  if (!est) return "";

  const lines = [
    `Total distance: ${est.totalDistanceKm.toFixed(1)} km`,
    `Vignette estimate: ${est.vignetteEstimateEur.toFixed(2)} EUR`,
    `Section toll estimate: ${est.sectionTollEstimateEur.toFixed(2)} EUR`,
    `Road charges total: ${est.totalRoadChargesEur.toFixed(2)} EUR`,
  ];

  if (est.powertrain === "electric" && est.electric) {
    lines.push(`Energy need: ${est.electric.kwhNeeded.toFixed(1)} kWh`);
    const chargingLow = est.electric.estimatedChargingCostEur * 0.85;
    const chargingHigh = est.electric.estimatedChargingCostEur * 1.15;
    lines.push(`Charging estimate: ~${est.electric.estimatedChargingCostEur.toFixed(2)} EUR (range ${chargingLow.toFixed(2)} - ${chargingHigh.toFixed(2)} EUR)`);
    if (est.electric.bestChargeCountryCode) {
      lines.push(
        `Best charging country: ${COUNTRY_NAMES[est.electric.bestChargeCountryCode]} (${est.electric.bestChargePriceEurPerKwh?.toFixed(2)} EUR/kWh)`,
      );
    }
  } else if (est.fuel) {
    lines.push(`Fuel need (${est.fuel.assumedFuelType}): ${est.fuel.litersNeeded.toFixed(1)} L`);
    lines.push(`Fuel estimate: ${est.fuel.estimatedFuelCostEur.toFixed(2)} EUR`);
    if (est.fuel.fuelStrategy) {
      lines.push(`Fuel strategy: ${est.fuel.fuelStrategy}`);
    } else if (est.fuel.bestTopUpCountryCode) {
      lines.push(
        `Cheapest fuel: ${COUNTRY_NAMES[est.fuel.bestTopUpCountryCode]} (${est.fuel.bestTopUpPriceEurPerLiter?.toFixed(2)} EUR/L). Plan stops based on tank range (${est.fuel.estimatedRangePerFullTankKm} km).`,
      );
    }
  }

  return lines.join("\n");
}
