import { describe, it, expect } from "vitest";
import { getAllCameraFeeds, getCameraPinsForCrossings } from "@/lib/border/cameraPins";
import type { CountryCode } from "@/types/vignette";

describe("getAllCameraFeeds", () => {
  const feeds = getAllCameraFeeds();

  it("returns a non-empty array", () => {
    expect(feeds.length).toBeGreaterThan(0);
  });

  it("each feed has label, url, lat, lon, countryCodeFrom, countryCodeTo", () => {
    for (const feed of feeds) {
      expect(feed).toHaveProperty("label");
      expect(feed).toHaveProperty("url");
      expect(typeof feed.lat).toBe("number");
      expect(typeof feed.lon).toBe("number");
      expect(feed).toHaveProperty("countryCodeFrom");
      expect(feed).toHaveProperty("countryCodeTo");
    }
  });
});

describe("getCameraPinsForCrossings", () => {
  it("returns cameras for a HR-SI crossing", () => {
    const result = getCameraPinsForCrossings([
      { countryCodeFrom: "HR" as CountryCode, countryCodeTo: "SI" as CountryCode, lat: 45.84, lon: 15.7 },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].cameras.length).toBeGreaterThan(0);
  });

  it("returns empty for an unsupported crossing (DE-AT)", () => {
    const result = getCameraPinsForCrossings([
      { countryCodeFrom: "DE" as CountryCode, countryCodeTo: "AT" as CountryCode, lat: 47.5, lon: 12.1 },
    ]);
    expect(result).toEqual([]);
  });

  it("returns at most 3 cameras per crossing", () => {
    const result = getCameraPinsForCrossings([
      { countryCodeFrom: "HR" as CountryCode, countryCodeTo: "BA" as CountryCode, lat: 43.12, lon: 17.57 },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].cameras.length).toBeLessThanOrEqual(3);
  });

  it("sorts cameras by distance (nearest first)", () => {
    const result = getCameraPinsForCrossings([
      { countryCodeFrom: "HR" as CountryCode, countryCodeTo: "SI" as CountryCode, lat: 45.84, lon: 15.7 },
    ]);
    const distances = result[0].cameras.map((c) => c.distanceKm);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });
});
