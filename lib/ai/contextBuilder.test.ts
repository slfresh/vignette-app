import { describe, it, expect } from "vitest";
import { buildRouteContext, buildRouteSummaryOneLiner } from "@/lib/ai/contextBuilder";
import type { RouteAnalysisResult, CountryCode } from "@/types/vignette";

const mockResult: RouteAnalysisResult = {
  countries: [
    {
      countryCode: "DE" as CountryCode,
      requiresVignette: false,
      requiresSectionToll: false,
      highwayDistanceMeters: 200_000,
      notices: [],
    },
    {
      countryCode: "AT" as CountryCode,
      requiresVignette: true,
      requiresSectionToll: true,
      highwayDistanceMeters: 150_000,
      notices: ["Buy before entering"],
    },
  ],
  tripEstimate: {
    totalDistanceKm: 450,
    totalRoadChargesEur: 35.5,
    vignetteEstimateEur: 12.5,
    sectionTollEstimateEur: 23.0,
    fuel: { estimatedFuelCostEur: 45.0 },
    vignetteBreakdown: [],
    sectionTollBreakdown: [],
  } as any,
  borderCrossings: [
    { countryCodeFrom: "DE" as CountryCode, countryCodeTo: "AT" as CountryCode, lat: 47.5, lon: 12.1 },
  ],
  sectionTolls: [
    { countryCode: "AT" as CountryCode, label: "Brenner", description: "Section toll on A13" },
  ],
  tripShield: {
    hasBorderCrossing: true,
    hasFreeFlowToll: false,
    hasMajorUrbanZoneRisk: false,
    warnings: [],
  },
  compliance: { official_source: true, informational_only: true, price_last_verified_at: "2026-01-01" },
  routeGeoJson: { type: "LineString", coordinates: [] } as any,
};

describe("buildRouteContext", () => {
  const context = buildRouteContext(mockResult);

  it("includes the CURRENT ROUTE DATA header", () => {
    expect(context).toContain("=== CURRENT ROUTE DATA ===");
  });

  it("includes distance and charges", () => {
    expect(context).toContain("450 km");
    expect(context).toContain("35.50 EUR");
  });

  it("includes country names with vignette status", () => {
    expect(context).toContain("DE (Germany)");
    expect(context).toContain("no vignette");
    expect(context).toContain("AT (Austria)");
    expect(context).toContain("VIGNETTE NEEDED");
  });

  it("includes notices", () => {
    expect(context).toContain("Buy before entering");
  });

  it("includes border crossings", () => {
    expect(context).toContain("DE → AT");
    expect(context).toContain("47.500");
    expect(context).toContain("12.100");
  });

  it("includes section tolls", () => {
    expect(context).toContain("Brenner");
    expect(context).toContain("Section toll on A13");
  });

  it("includes trip shield data", () => {
    expect(context).toContain("Border crossings: yes");
    expect(context).toContain("Free-flow toll risk: no");
    expect(context).toContain("Urban zone charge risk: no");
  });
});

describe("buildRouteSummaryOneLiner", () => {
  it("returns a formatted one-liner with distance, cost, and countries", () => {
    const oneLiner = buildRouteSummaryOneLiner(mockResult);
    expect(oneLiner).toBe("Route (450 km, ~35.50 EUR in tolls) through Germany, Austria");
  });
});
