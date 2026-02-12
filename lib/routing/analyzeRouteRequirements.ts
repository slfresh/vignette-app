import { HIGHWAY_CATEGORIES, ORS_COUNTRY_ID_MAP, TOLLWAY_CATEGORIES } from "@/lib/config/countryRules";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type { CountryCode, CountryTravelSummary, RouteAnalysisRequest, RouteLineString } from "@/types/vignette";

interface CoverageAccumulator {
  highwayDistanceMeters: number;
  hasHighway: boolean;
  hasTollway: boolean;
}

function getCategoryForSegment(index: number, wayCategories: [number, number, number][]): number {
  const hit = wayCategories.find(([start, end]) => index >= start && index <= end);
  return hit ? hit[2] : 0;
}

export interface AnalysisDraft {
  lineString: RouteLineString;
  countries: Map<CountryCode, CoverageAccumulator>;
}

export function analyzeRouteRequirements(
  response: OrsDirectionsResponse,
  request: RouteAnalysisRequest,
): AnalysisDraft {
  void request;
  const feature = response.features?.[0];
  if (!feature) {
    throw new Error("No route returned by OpenRouteService.");
  }

  const coordinates = feature.geometry?.coordinates;
  if (!coordinates?.length) {
    throw new Error("Route geometry is missing.");
  }

  const extras = feature.properties?.extras;
  const countryRanges = extras?.countryinfo?.values ?? [];
  const wayRanges = extras?.waycategory?.values ?? [];

  if (!countryRanges.length) {
    throw new Error("Route metadata is missing country information.");
  }

  const countries = new Map<CountryCode, CoverageAccumulator>();

  for (const [start, end, countryId] of countryRanges) {
    const countryCode = ORS_COUNTRY_ID_MAP[countryId];
    if (!countryCode) {
      continue;
    }

    const existing = countries.get(countryCode) ?? {
      highwayDistanceMeters: 0,
      hasHighway: false,
      hasTollway: false,
    };

    for (let idx = start; idx < end; idx += 1) {
      const current = coordinates[idx];
      const next = coordinates[idx + 1];
      if (!current || !next) {
        continue;
      }

      const dx = next[0] - current[0];
      const dy = next[1] - current[1];
      const roughMeters = Math.sqrt(dx * dx + dy * dy) * 111_000;

      const category = getCategoryForSegment(idx, wayRanges);
      if (HIGHWAY_CATEGORIES.has(category)) {
        existing.hasHighway = true;
        existing.highwayDistanceMeters += roughMeters;
      }
      if (TOLLWAY_CATEGORIES.has(category)) {
        existing.hasTollway = true;
      }
    }

    countries.set(countryCode, existing);
  }

  return {
    lineString: {
      type: "LineString",
      coordinates,
    },
    countries,
  };
}

export function mapCountrySummaries(
  draft: AnalysisDraft,
  decisionResolver: (countryCode: CountryCode, hasHighway: boolean, hasTollway: boolean) => Omit<CountryTravelSummary, "countryCode" | "highwayDistanceMeters">,
): CountryTravelSummary[] {
  return Array.from(draft.countries.entries()).map(([countryCode, data]) => {
    const decision = decisionResolver(countryCode, data.hasHighway, data.hasTollway);
    return {
      countryCode,
      highwayDistanceMeters: Math.round(data.highwayDistanceMeters),
      requiresVignette: decision.requiresVignette,
      requiresSectionToll: decision.requiresSectionToll,
      notices: decision.notices,
    };
  });
}
