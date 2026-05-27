import { describe, it, expect } from "vitest";
import { buildTripEstimate } from "@/lib/routing/builders/tripEstimate";
import type { RouteAnalysisRequest, RouteAnalysisResult } from "@/types/vignette";

const baseRequest: RouteAnalysisRequest = {
  start: "Munich",
  end: "Vienna",
};

function makeCountry(countryCode: RouteAnalysisResult["countries"][0]["countryCode"], highwayMeters: number) {
  return {
    countryCode,
    requiresVignette: false,
    requiresSectionToll: false,
    highwayDistanceMeters: highwayMeters,
    notices: [],
    routeSegments: [],
  };
}

describe("buildTripEstimate", () => {
  it("returns zero road charges when no vignettes or section tolls", () => {
    const result = buildTripEstimate(
      { countries: [makeCountry("DE", 100_000)], sectionTolls: [] },
      baseRequest,
      100_000,
    );
    expect(result.totalRoadChargesEur).toBe(0);
    expect(result.totalDistanceKm).toBe(100);
    expect(result.powertrain).toBe("combustion");
    expect(result.fuel?.litersNeeded).toBeGreaterThan(0);
  });

  it("builds electric estimate for ELECTRIC powertrain", () => {
    const estimate = buildTripEstimate(
      { countries: [makeCountry("DE", 50_000), makeCountry("AT", 50_000)], sectionTolls: [] },
      { ...baseRequest, powertrainType: "ELECTRIC" },
      200_000,
    );
    expect(estimate.powertrain).toBe("electric");
    expect(estimate.fuel).toBeUndefined();
    expect(estimate.electric?.kwhNeeded).toBeGreaterThan(0);
  });

  it("uses fallback fuel price when route countries lack price data", () => {
    const estimate = buildTripEstimate(
      { countries: [makeCountry("XK", 100_000)], sectionTolls: [] },
      baseRequest,
      100_000,
    );
    expect(estimate.fuel?.averagePricePerLiterEur).toBe(1.75);
  });
});
