import { evaluateCountryRequirement, getSectionTollNotices } from "@/lib/config/countryRules";
import { PRICE_LAST_VERIFIED_AT } from "@/lib/config/pricing2026";
import { analyzeRouteRequirements, mapCountrySummaries } from "@/lib/routing/analyzeRouteRequirements";
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

  return {
    routeGeoJson: draft.lineString,
    countries,
    sectionTolls,
    compliance: {
      official_source: true,
      informational_only: true,
      price_last_verified_at: PRICE_LAST_VERIFIED_AT,
    },
  };
}
