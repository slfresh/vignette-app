import { COUNTRY_NAMES as COUNTRY_LABELS } from "@/lib/config/countryNames";
import type {
  CountryCode,
  ConfidenceReasonKey,
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
    const actionKey: TripTimelineEntry["actionKey"] = country.requiresVignette
      ? "timeline.action.buyVignette"
      : country.requiresSectionToll
        ? "timeline.action.sectionToll"
        : "timeline.action.noVignette";
    const estimatedCostEur = (vignetteCostByCountry.get(country.countryCode) ?? 0) + (sectionCostByCountry.get(country.countryCode) ?? 0);
    return {
      countryCode: country.countryCode,
      label: COUNTRY_LABELS[country.countryCode],
      actionKey,
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
  const confidenceReasonKeys: ConfidenceReasonKey[] = [];
  if (!request.dateISO) {
    confidenceScore -= 10;
    confidenceReasonKeys.push("readiness.confidence.noDate");
  }
  if (!request.powertrainType) {
    confidenceScore -= 8;
    confidenceReasonKeys.push("readiness.confidence.noPowertrain");
  }
  if (request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") {
    if (request.grossWeightKg === undefined) {
      confidenceScore -= 12;
      confidenceReasonKeys.push("readiness.confidence.noGrossWeight");
    }
    if (request.axles === undefined) {
      confidenceScore -= 8;
      confidenceReasonKeys.push("readiness.confidence.noAxles");
    }
  }
  if (request.emissionClass === "UNKNOWN") {
    confidenceScore -= 8;
    confidenceReasonKeys.push("readiness.confidence.unknownEmission");
  }
  if (result.countries.length >= 4) {
    confidenceScore -= 6;
    confidenceReasonKeys.push("readiness.confidence.multiCountry");
  }
  if (result.countries.some((country) => country.requiresSectionToll) && tripEstimate.sectionTollBreakdown.length === 0) {
    confidenceScore -= 10;
    confidenceReasonKeys.push("readiness.confidence.missingSectionToll");
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const confidenceLevel: TripReadiness["confidenceLevel"] =
    confidenceScore >= 80 ? "high" : confidenceScore >= 55 ? "medium" : "low";

  if (!confidenceReasonKeys.length) {
    confidenceReasonKeys.push("readiness.confidence.strongBaseline");
  }

  return {
    confidenceScore,
    confidenceLevel,
    confidenceReasonKeys,
    timeline,
    checklist: Array.from(checklist),
  };
}
