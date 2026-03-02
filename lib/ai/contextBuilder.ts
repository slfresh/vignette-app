/**
 * Builds contextual information to inject into AI conversations.
 *
 * When a user has calculated a route, we serialize the key results
 * so the AI can give specific, data-driven advice about their trip.
 */

import type { RouteAnalysisResult, CountryCode } from "@/types/vignette";

/** Simple country code → name lookup for AI context. */
const COUNTRY_NAMES: Record<CountryCode, string> = {
  DE: "Germany", AT: "Austria", CZ: "Czech Republic", SK: "Slovakia",
  HU: "Hungary", SI: "Slovenia", CH: "Switzerland", RO: "Romania",
  BG: "Bulgaria", HR: "Croatia", RS: "Serbia", DK: "Denmark",
  SE: "Sweden", NL: "Netherlands", BE: "Belgium", FR: "France",
  IT: "Italy", BA: "Bosnia and Herzegovina", ME: "Montenegro",
  XK: "Kosovo", MK: "North Macedonia", AL: "Albania", PL: "Poland",
  ES: "Spain", PT: "Portugal", GB: "United Kingdom", IE: "Ireland",
  TR: "Turkey", GR: "Greece",
};

/**
 * Build a compact text summary of route results for AI context.
 * Keeps token count low while providing all essential data.
 */
export function buildRouteContext(result: RouteAnalysisResult): string {
  const lines: string[] = [];

  lines.push("=== CURRENT ROUTE DATA ===");

  if (result.tripEstimate) {
    const est = result.tripEstimate;
    lines.push(`Total distance: ${est.totalDistanceKm.toFixed(0)} km`);
    lines.push(`Estimated road charges: ${est.totalRoadChargesEur.toFixed(2)} EUR`);
    lines.push(`  - Vignettes: ${est.vignetteEstimateEur.toFixed(2)} EUR`);
    lines.push(`  - Section tolls: ${est.sectionTollEstimateEur.toFixed(2)} EUR`);
    if (est.fuel) {
      lines.push(`  - Fuel estimate: ~${est.fuel.estimatedFuelCostEur.toFixed(2)} EUR`);
    }
    if (est.electric) {
      lines.push(`  - Charging estimate: ~${est.electric.estimatedChargingCostEur.toFixed(2)} EUR`);
    }
  }

  lines.push("\nCountries on route:");
  for (const country of result.countries) {
    const name = COUNTRY_NAMES[country.countryCode] ?? country.countryCode;
    const vigLabel = country.requiresVignette ? "VIGNETTE NEEDED" : "no vignette";
    const tollLabel = country.requiresSectionToll ? "+ section tolls" : "";
    const distKm = (country.highwayDistanceMeters / 1000).toFixed(0);
    lines.push(`  ${country.countryCode} (${name}): ${distKm} km highway — ${vigLabel} ${tollLabel}`);

    if (country.notices?.length) {
      for (const notice of country.notices) {
        lines.push(`    ! ${notice}`);
      }
    }
  }

  if (result.borderCrossings?.length) {
    lines.push("\nBorder crossings:");
    for (const bc of result.borderCrossings) {
      lines.push(`  ${bc.countryCodeFrom} → ${bc.countryCodeTo} at (${bc.lat.toFixed(3)}, ${bc.lon.toFixed(3)})`);
    }
  }

  if (result.sectionTolls?.length) {
    lines.push("\nSection toll notices:");
    for (const toll of result.sectionTolls) {
      lines.push(`  ${toll.countryCode}: ${toll.label} — ${toll.description}`);
    }
  }

  if (result.tripShield) {
    const ts = result.tripShield;
    lines.push("\nTrip Shield:");
    lines.push(`  Border crossings: ${ts.hasBorderCrossing ? "yes" : "no"}`);
    lines.push(`  Free-flow toll risk: ${ts.hasFreeFlowToll ? "yes" : "no"}`);
    lines.push(`  Urban zone charge risk: ${ts.hasMajorUrbanZoneRisk ? "yes" : "no"}`);
  }

  lines.push("=== END ROUTE DATA ===");
  return lines.join("\n");
}

/** Format a route summary as a brief one-liner for conversation starters. */
export function buildRouteSummaryOneLiner(result: RouteAnalysisResult): string {
  const countries = result.countries.map((c) => COUNTRY_NAMES[c.countryCode] ?? c.countryCode).join(", ");
  const dist = result.tripEstimate?.totalDistanceKm?.toFixed(0) ?? "?";
  const cost = result.tripEstimate?.totalRoadChargesEur?.toFixed(2) ?? "?";
  return `Route (${dist} km, ~${cost} EUR in tolls) through ${countries}`;
}
