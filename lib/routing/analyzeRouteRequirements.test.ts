import { describe, expect, it } from "vitest";
import { analyzeRouteRequirements } from "@/lib/routing/analyzeRouteRequirements";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";

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
  });
});
