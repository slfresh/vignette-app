import { describe, it, expect } from "vitest";
import { buildSummaryText } from "@/lib/utils/shareSummary";
import type { RouteAnalysisResult } from "@/types/vignette";

const baseResult: RouteAnalysisResult = {
  countries: [],
  sectionTolls: [],
  compliance: { official_source: true, informational_only: true, price_last_verified_at: "2026-01-01" },
  routeGeoJson: { type: "LineString", coordinates: [[13, 48], [16, 48]] },
  tripEstimate: {
    totalDistanceKm: 450,
    vignetteEstimateEur: 12.5,
    sectionTollEstimateEur: 8,
    totalRoadChargesEur: 20.5,
    powertrain: "combustion",
    assumptions: [],
    vignetteBreakdown: [],
    sectionTollBreakdown: [],
    fuel: {
      assumedFuelType: "petrol",
      litersNeeded: 40,
      averagePricePerLiterEur: 1.5,
      estimatedFuelCostEur: 60,
      routeCountryFuelPrices: [],
      estimatedRangePerFullTankKm: 600,
      suggestedTopUpCountries: [],
      bestTopUpCountryCode: "DE",
      bestTopUpPriceEurPerLiter: 1.55,
    },
  },
};

describe("buildSummaryText", () => {
  it("includes distance and road charges in English", () => {
    const text = buildSummaryText(baseResult, "en");
    expect(text).toContain("450.0 km");
    expect(text).toContain("20.50 EUR");
    expect(text).toContain("Fuel need");
  });

  it("uses German labels when locale is de", () => {
    const text = buildSummaryText(baseResult, "de");
    expect(text).toContain("Gesamtstrecke");
  });

  it("returns empty string when no trip estimate", () => {
    expect(buildSummaryText({ ...baseResult, tripEstimate: undefined }, "en")).toBe("");
  });
});
