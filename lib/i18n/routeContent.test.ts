import { describe, it, expect } from "vitest";
import { getFuelStrategyText, getTimelineActionText, getTimelineCostText } from "@/lib/i18n/routeContent";
import type { TripTimelineEntry } from "@/types/vignette";

describe("routeContent i18n", () => {
  const entry: TripTimelineEntry = {
    countryCode: "AT",
    label: "Austria",
    actionKey: "timeline.action.buyVignette",
    requiresVignette: true,
    requiresSectionToll: false,
    hasUrbanAccessRisk: false,
  };

  it("translates timeline actions by locale", () => {
    expect(getTimelineActionText(entry, "de")).toContain("Nationalvignette");
    expect(getTimelineActionText(entry, "en")).toContain("Buy national vignette");
  });

  it("formats estimated cost without minus prefix", () => {
    expect(getTimelineCostText(9.5, "en")).toBe("~9.50 EUR");
    expect(getTimelineCostText(9.5, "de")).toBe("~9.50 EUR");
  });

  it("translates fuel strategy keys", () => {
    const text = getFuelStrategyText(
      {
        assumedFuelType: "petrol",
        litersNeeded: 90,
        averagePricePerLiterEur: 1.7,
        estimatedFuelCostEur: 150,
        routeCountryFuelPrices: [],
        estimatedRangePerFullTankKm: 700,
        suggestedTopUpCountries: [],
        fuelStrategyKey: "fuel.strategyTwoStop",
        fuelStrategyParams: {
          countryCode: "BA",
          price: "1.49",
          interimCountryCode: "DE",
          interimPrice: "1.82",
        },
      },
      "de",
    );
    expect(text).toContain("Günstigster Kraftstoff");
    expect(text).toMatch(/Deutschland|Germany/);
  });
});
