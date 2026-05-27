import { evaluateCountryRequirement, getSectionTollNotices } from "@/lib/config/countryRules";
import { PRICE_LAST_VERIFIED_AT } from "@/lib/config/pricing2026";
import { analyzeRouteRequirements, mapCountrySummaries } from "@/lib/routing/analyzeRouteRequirements";
import { buildTripEstimate } from "@/lib/routing/builders/tripEstimate";
import { buildTripShieldInsights } from "@/lib/routing/builders/tripShield";
import { buildTripReadiness } from "@/lib/routing/builders/tripReadiness";
import { extractBorderCrossings } from "@/lib/routing/builders/borderCrossings";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type { RouteAnalysisRequest, RouteAnalysisResult } from "@/types/vignette";

export function applyCountryRules(
  response: OrsDirectionsResponse,
  request: RouteAnalysisRequest,
): RouteAnalysisResult {
  const draft = analyzeRouteRequirements(response, request);

  const countries = mapCountrySummaries(draft, (countryCode, hasHighway, hasTollway) =>
    evaluateCountryRequirement(countryCode, hasHighway, hasTollway, request),
  );
  const routeCountries = countries.map((country) => country.countryCode);

  const sectionTolls = countries
    .filter((country) => country.requiresSectionToll)
    .flatMap((country) => getSectionTollNotices(country.countryCode, request, routeCountries));
  const tripShield = buildTripShieldInsights({ countries, sectionTolls }, request);
  const tripEstimate = buildTripEstimate({ countries, sectionTolls }, request, draft.totalDistanceMeters);
  const tripReadiness = buildTripReadiness({ countries, sectionTolls, tripShield }, request, tripEstimate);
  const borderCrossings = extractBorderCrossings(draft);

  return {
    routeGeoJson: draft.lineString,
    countries,
    sectionTolls,
    estimatedDurationSeconds: draft.totalDurationSeconds || undefined,
    tripEstimate,
    tripShield,
    tripReadiness,
    borderCrossings,
    compliance: {
      official_source: true,
      informational_only: true,
      price_last_verified_at: PRICE_LAST_VERIFIED_AT,
    },
  };
}
