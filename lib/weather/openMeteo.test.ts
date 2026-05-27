import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRouteWeather } from "@/lib/weather/openMeteo";

describe("fetchRouteWeather", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty forecast for empty coordinates", async () => {
    const result = await fetchRouteWeather([]);
    expect(result.points).toHaveLength(0);
    expect(result.warnings).toEqual([]);
  });

  it("fetches and aggregates weather for route points", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hourly: {
            time: ["2026-05-27T12:00"],
            temperature_2m: [18],
            wind_speed_10m: [12],
            wind_gusts_10m: [20],
            precipitation_probability: [10],
            visibility: [10000],
            weather_code: [1],
          },
        }),
      }),
    );

    const coords: [number, number][] = [
      [13.0, 48.0],
      [16.0, 48.5],
    ];
    const result = await fetchRouteWeather(coords);
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points[0].temperature).toBe(18);
    expect(result.fetchedAt).toBeTruthy();
  });
});
