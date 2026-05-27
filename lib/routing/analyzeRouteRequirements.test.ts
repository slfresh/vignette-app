import { describe, expect, it } from "vitest";
import { analyzeRouteRequirements, mapCountrySummaries } from "@/lib/routing/analyzeRouteRequirements";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";

function roughMetersApprox(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy) * 111_000;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
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

describe("analyzeRouteRequirements", () => {
  it("aggregates country and highway coverage", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [11.5, 48.1],
              [11.8, 48.2],
              [12.1, 48.3],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 11]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = analyzeRouteRequirements(sample, { start: "A", end: "B" });
    expect(result.countries.get("AT")).toBeDefined();
    expect(result.countries.get("AT")?.hasHighway).toBe(true);
    expect(result.countries.get("AT")?.highwayDistanceMeters).toBeGreaterThan(0);
  });

  it("uses haversine for highway distance (more accurate at high latitude)", () => {
    const northEdge: [number, number] = [10.0, 60.0];
    const northNext: [number, number] = [11.0, 60.0];
    const southEdge: [number, number] = [10.0, 40.0];
    const southNext: [number, number] = [11.0, 40.0];

    const roughNorth = roughMetersApprox(northEdge, northNext);
    const haversineNorth = haversineMeters(northEdge, northNext);
    const roughSouth = roughMetersApprox(southEdge, southNext);
    const haversineSouth = haversineMeters(southEdge, southNext);

    // Same lon delta: rough method treats north and south identically; haversine shrinks at higher latitude.
    expect(Math.abs(roughNorth - roughSouth)).toBeLessThan(1);
    expect(haversineNorth).toBeLessThan(roughNorth);
    expect(haversineSouth).toBeGreaterThan(haversineNorth);

    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [northEdge, northNext],
          },
          properties: {
            extras: {
              countryinfo: { values: [[0, 1, 11]] },
              waycategory: { values: [[0, 1, 1]] },
            },
          },
        },
      ],
    };

    const result = analyzeRouteRequirements(sample, { start: "A", end: "B" });
    const highwayMeters = result.countries.get("AT")?.highwayDistanceMeters ?? 0;
    expect(highwayMeters).toBeCloseTo(haversineNorth, -1);
    expect(highwayMeters).not.toBeCloseTo(roughNorth, -1);
  });
});

describe("mapCountrySummaries", () => {
  it("shares boundary coordinates between adjacent country segments", () => {
    const coordinates: [number, number][] = [
      [11.0, 48.0],
      [11.5, 48.1],
      [12.0, 48.2],
      [12.5, 48.3],
    ];

    const draft = {
      lineString: { type: "LineString" as const, coordinates },
      countries: new Map([
        [
          "AT" as const,
          {
            highwayDistanceMeters: 1000,
            hasHighway: true,
            hasTollway: false,
            segmentRanges: [
              { start: 0, end: 2 },
              { start: 2, end: 3 },
            ],
          },
        ],
      ]),
      totalDistanceMeters: 1000,
      totalDurationSeconds: 60,
    };

    const summaries = mapCountrySummaries(draft, () => ({
      requiresVignette: false,
      requiresSectionToll: false,
      notices: [],
    }));

    expect(summaries).toHaveLength(1);
    const summary = summaries[0]!;
    const segment = summary.routeSegments?.[0];
    expect(segment?.coordinates).toHaveLength(4);
    expect(segment!.coordinates[0]).toEqual([11.0, 48.0]);
    expect(segment!.coordinates[3]).toEqual([12.5, 48.3]);
  });

  it("aligns boundary points between two countries at shared index", () => {
    const coordinates: [number, number][] = [
      [11.0, 48.0],
      [11.5, 48.1],
      [12.0, 48.2],
    ];

    const draft = {
      lineString: { type: "LineString" as const, coordinates },
      countries: new Map([
        [
          "AT" as const,
          {
            highwayDistanceMeters: 500,
            hasHighway: true,
            hasTollway: false,
            segmentRanges: [{ start: 0, end: 1 }],
          },
        ],
        [
          "DE" as const,
          {
            highwayDistanceMeters: 500,
            hasHighway: true,
            hasTollway: false,
            segmentRanges: [{ start: 1, end: 2 }],
          },
        ],
      ]),
      totalDistanceMeters: 1000,
      totalDurationSeconds: 60,
    };

    const summaries = mapCountrySummaries(draft, () => ({
      requiresVignette: false,
      requiresSectionToll: false,
      notices: [],
    }));

    const atCoords = summaries.find((s) => s.countryCode === "AT")?.routeSegments?.[0]?.coordinates;
    const deCoords = summaries.find((s) => s.countryCode === "DE")?.routeSegments?.[0]?.coordinates;
    expect(atCoords?.length).toBeGreaterThan(0);
    expect(deCoords?.length).toBeGreaterThan(0);
    if (!atCoords || !deCoords) throw new Error("missing segments");
    expect(atCoords[atCoords.length - 1]).toEqual(deCoords[0]);
  });
});
