import { HIGHWAY_CATEGORIES, ORS_COUNTRY_ID_MAP, TOLLWAY_CATEGORIES } from "@/lib/config/countryRules";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type { CountryCode, CountryTravelSummary, RouteAnalysisRequest, RouteLineString } from "@/types/vignette";

interface CoverageAccumulator {
  highwayDistanceMeters: number;
  hasHighway: boolean;
  hasTollway: boolean;
  segmentRanges: Array<{ start: number; end: number }>;
}

function getCategoryForSegment(index: number, wayCategories: [number, number, number][]): number {
  const hit = wayCategories.find(([start, end]) => index >= start && index <= end);
  return hit ? hit[2] : 0;
}

export interface AnalysisDraft {
  lineString: RouteLineString;
  countries: Map<CountryCode, CoverageAccumulator>;
  totalDistanceMeters: number;
}

function distanceMetersBetween(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return 6_371_000 * c;
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
  let computedDistanceMeters = 0;

  for (let idx = 0; idx < coordinates.length - 1; idx += 1) {
    const current = coordinates[idx];
    const next = coordinates[idx + 1];
    if (!current || !next) {
      continue;
    }
    computedDistanceMeters += distanceMetersBetween(current, next);
  }

  for (const [start, end, countryId] of countryRanges) {
    const countryCode = ORS_COUNTRY_ID_MAP[countryId];
    if (!countryCode) {
      continue;
    }

    const existing = countries.get(countryCode) ?? {
      highwayDistanceMeters: 0,
      hasHighway: false,
      hasTollway: false,
      segmentRanges: [],
    };
    existing.segmentRanges.push({ start, end });

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
    totalDistanceMeters: feature.properties?.summary?.distance ?? Math.round(computedDistanceMeters),
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
      routeSegments: data.segmentRanges
        .map((range) => {
          const segmentCoordinates = draft.lineString.coordinates.slice(range.start, range.end + 1);
          if (segmentCoordinates.length < 2) {
            return null;
          }
          return {
            type: "LineString" as const,
            coordinates: segmentCoordinates,
          };
        })
        .filter((segment): segment is { type: "LineString"; coordinates: [number, number][] } => Boolean(segment)),
    };
  });
}
