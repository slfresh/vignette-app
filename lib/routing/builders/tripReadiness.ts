import { COUNTRY_NAMES as COUNTRY_LABELS } from "@/lib/config/countryNames";
import type {
  CountryCode,
  RouteAnalysisRequest,
  RouteAnalysisResult,
  TripEstimate,
  TripReadiness,
  TripTimelineEntry,
} from "@/types/vignette";

export function buildTripReadiness(
  result: Pick<RouteAnalysisResult, "countries" | "sectionTolls" | "tripShield">,
  request: RouteAnalysisRequest,
  tripEstimate: TripEstimate,
): TripReadiness {
  const vignetteCostByCountry = new Map<CountryCode, number>();
  for (const item of tripEstimate.vignetteBreakdown) {
    vignetteCostByCountry.set(item.countryCode, (vignetteCostByCountry.get(item.countryCode) ?? 0) + item.priceEur);
  }
  const sectionCostByCountry = new Map<CountryCode, number>();
  for (const item of tripEstimate.sectionTollBreakdown) {
    sectionCostByCountry.set(item.countryCode, (sectionCostByCountry.get(item.countryCode) ?? 0) + item.estimatedEur);
  }

  const timeline: TripTimelineEntry[] = result.countries.map((country) => {
    const countryNoticeText = country.notices.join(" ").toLowerCase();
    const hasUrbanAccessRisk =
      countryNoticeText.includes("ulez") ||
      countryNoticeText.includes("congestion") ||
      countryNoticeText.includes("crit'air") ||
      countryNoticeText.includes("umwelt") ||
      countryNoticeText.includes("low-emission");
    const action = country.requiresVignette
      ? "Buy national vignette before highway entry."
      : country.requiresSectionToll
        ? "Prepare section/distance toll payment for this country."
        : "No national vignette expected on standard passenger routes.";
    const estimatedCostEur = (vignetteCostByCountry.get(country.countryCode) ?? 0) + (sectionCostByCountry.get(country.countryCode) ?? 0);
    return {
      countryCode: country.countryCode,
      label: COUNTRY_LABELS[country.countryCode],
      action,
      estimatedCostEur: estimatedCostEur > 0 ? Number(estimatedCostEur.toFixed(2)) : undefined,
      requiresVignette: country.requiresVignette,
      requiresSectionToll: country.requiresSectionToll,
      hasUrbanAccessRisk,
    };
  });

  const checklist = new Set<string>();
  if (result.countries.some((country) => country.requiresVignette)) {
    checklist.add("Buy required vignettes before departure and keep confirmation receipts.");
  }
  if (result.countries.some((country) => country.requiresSectionToll)) {
    checklist.add("Review section toll notes and official links for each toll country.");
  }
  if (result.tripShield?.hasFreeFlowToll) {
    checklist.add("For free-flow corridors, verify payment completion windows (often 72h).");
  }
  if (result.tripShield?.hasMajorUrbanZoneRisk) {
    checklist.add("Check city emission/urban access zones (ULEZ/Crit'Air/Umwelt) before entry.");
  }
  if (result.tripShield?.hasBorderCrossing) {
    checklist.add("Carry registration and identity documents for all border crossings.");
  }
  if ((request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") && request.grossWeightKg === undefined) {
    checklist.add("Add vehicle gross weight to improve toll category accuracy.");
  }
  if (request.powertrainType === "ELECTRIC") {
    checklist.add("Plan charging stops with backup chargers on long-distance segments.");
  }

  let confidenceScore = 100;
  const confidenceReasons: string[] = [];
  if (!request.dateISO) {
    confidenceScore -= 10;
    confidenceReasons.push("Trip date missing, so time-window toll hints are less precise.");
  }
  if (!request.powertrainType) {
    confidenceScore -= 8;
    confidenceReasons.push("Powertrain type missing, fuel/energy estimates use defaults.");
  }
  if (request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") {
    if (request.grossWeightKg === undefined) {
      confidenceScore -= 12;
      confidenceReasons.push("Gross weight missing for van/camper profile.");
    }
    if (request.axles === undefined) {
      confidenceScore -= 8;
      confidenceReasons.push("Axle count missing for van/camper profile.");
    }
  }
  if (request.emissionClass === "UNKNOWN") {
    confidenceScore -= 8;
    confidenceReasons.push("Emission class unknown, urban-zone checks are conservative.");
  }
  if (result.countries.length >= 4) {
    confidenceScore -= 6;
    confidenceReasons.push("Multi-country route complexity increases pricing uncertainty.");
  }
  if (result.countries.some((country) => country.requiresSectionToll) && tripEstimate.sectionTollBreakdown.length === 0) {
    confidenceScore -= 10;
    confidenceReasons.push("Some section toll segments lack country-specific estimate values.");
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const confidenceLevel: TripReadiness["confidenceLevel"] =
    confidenceScore >= 80 ? "high" : confidenceScore >= 55 ? "medium" : "low";

  if (!confidenceReasons.length) {
    confidenceReasons.push("Route profile includes enough details for a strong estimate baseline.");
  }

  return {
    confidenceScore,
    confidenceLevel,
    confidenceReasons,
    timeline,
    checklist: Array.from(checklist),
  };
}
