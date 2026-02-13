import { describe, expect, it } from "vitest";
import { applyCountryRules } from "@/lib/routing/applyCountryRules";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";

describe("applyCountryRules", () => {
  it("adds country notices and section toll hints", () => {
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
                values: [[0, 2, 3]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Munich",
      end: "Innsbruck",
      dateISO: "2026-06-14",
      seats: 5,
    });

    expect(result.countries[0]?.countryCode).toBe("AT");
    expect(result.countries[0]?.requiresVignette).toBe(true);
    expect(result.sectionTolls.length).toBeGreaterThan(0);
    expect(result.tripEstimate?.totalDistanceKm).toBeGreaterThan(0);
    expect(result.tripEstimate?.totalRoadChargesEur).toBeGreaterThan(0);
    expect(result.tripReadiness?.timeline.length).toBeGreaterThan(0);
    expect(result.tripReadiness?.checklist.length).toBeGreaterThan(0);
  });

  it("flags Croatia as section toll instead of vignette", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [16.0, 45.8],
              [16.5, 45.5],
              [17.0, 45.2],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 49]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Zagreb",
      end: "Osijek",
    });

    expect(result.countries[0]?.countryCode).toBe("HR");
    expect(result.countries[0]?.requiresVignette).toBe(false);
    expect(result.countries[0]?.requiresSectionToll).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.countryCode === "HR")).toBe(true);
  });

  it("flags France motorway as toll-based without vignette", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [2.3522, 48.8566],
              [3.5, 47.8],
              [4.8357, 45.764],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 70]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Paris",
      end: "Lyon",
      dateISO: "2026-06-14",
    });

    expect(result.countries[0]?.countryCode).toBe("FR");
    expect(result.countries[0]?.requiresVignette).toBe(false);
    expect(result.countries[0]?.requiresSectionToll).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.countryCode === "FR")).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.label === "France Flux Libre (Free-Flow)")).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.label === "France A1/A14 time-window pricing")).toBe(true);
    expect(result.tripShield?.hasFreeFlowToll).toBe(true);
    expect(result.tripShield?.departureTimeHint).toBeDefined();
    expect(result.tripShield?.tollWindowImpact?.level).toBe("savings_opportunity");
    expect(result.tripShield?.warnings.some((warning) => warning.includes("72 hours"))).toBe(true);
  });

  it("flags Poland motorway as toll-based without vignette", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [21.0122, 52.2297],
              [20.0, 51.5],
              [19.0238, 50.2649],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 159]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Warsaw",
      end: "Krakow",
    });

    expect(result.countries[0]?.countryCode).toBe("PL");
    expect(result.countries[0]?.requiresVignette).toBe(false);
    expect(result.countries[0]?.requiresSectionToll).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.countryCode === "PL")).toBe(true);
  });

  it("flags Turkey motorway as toll-based without vignette", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [28.9784, 41.0082],
              [30.5, 40.5],
              [32.8597, 39.9334],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 206]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Istanbul",
      end: "Ankara",
    });

    expect(result.countries[0]?.countryCode).toBe("TR");
    expect(result.countries[0]?.requiresVignette).toBe(false);
    expect(result.countries[0]?.requiresSectionToll).toBe(true);
    expect(result.sectionTolls.some((notice) => notice.countryCode === "TR")).toBe(true);
  });

  it("adds London ULEZ and channel crossing notices for UK routes", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [2.1734, 41.3851],
              [1.0, 45.0],
              [0.5, 50.5],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [
                  [0, 1, 70],
                  [1, 2, 213],
                ],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Paris",
      end: "London",
    });

    const labels = result.sectionTolls.map((notice) => notice.label);
    expect(labels).toContain("London ULEZ/Congestion");
    expect(labels).toContain("Channel Crossing Booking");
    expect(result.tripShield?.hasMajorUrbanZoneRisk).toBe(true);
    expect(result.tripShield?.hasBorderCrossing).toBe(true);
  });

  it("marks tolls as avoided when avoid-tolls route stays off tollway segments", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [2.3522, 48.8566],
              [3.5, 47.8],
              [4.8357, 45.764],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 70]],
              },
              // Category 1 highway, but no explicit tollway category in this sample.
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Paris",
      end: "Lyon",
      avoidTolls: true,
    });

    expect(result.countries[0]?.countryCode).toBe("FR");
    expect(result.countries[0]?.requiresSectionToll).toBe(false);
    expect(result.countries[0]?.notices.some((text) => text.includes("Tolls avoided"))).toBe(true);
  });

  it("shows surcharge risk hint for France toll windows on Fridays", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [2.3522, 48.8566],
              [3.5, 47.8],
              [4.8357, 45.764],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 2, 70]],
              },
              waycategory: {
                values: [[0, 2, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Paris",
      end: "Lyon",
      dateISO: "2026-06-12",
    });

    expect(result.tripShield?.tollWindowImpact?.level).toBe("surcharge_risk");
  });

  it("adds heavy-vehicle notice when gross weight exceeds 3.5t", () => {
    const sample: OrsDirectionsResponse = {
      type: "FeatureCollection",
      features: [
        {
          geometry: {
            type: "LineString",
            coordinates: [
              [13.0, 47.0],
              [13.2, 47.2],
            ],
          },
          properties: {
            extras: {
              countryinfo: {
                values: [[0, 1, 11]],
              },
              waycategory: {
                values: [[0, 1, 1]],
              },
            },
          },
        },
      ],
    };

    const result = applyCountryRules(sample, {
      start: "Salzburg",
      end: "Graz",
      grossWeightKg: 4200,
      axles: 2,
    });

    expect(result.countries[0]?.notices.some((notice) => notice.includes(">3.5t"))).toBe(true);
  });
});
