import { describe, expect, it } from "vitest";
import { buildRouteSearchParams, buildShareUrl, parseRoutePointParams } from "@/lib/utils/routeUrl";

describe("routeUrl", () => {
  it("round-trips coordinate params", () => {
    const params = buildRouteSearchParams({
      start: "Munich, Germany",
      end: "Vienna, Austria",
      startPoint: { lat: 48.137, lon: 11.575 },
      endPoint: { lat: 48.208, lon: 16.373 },
    });

    expect(params.get("from")).toBe("Munich, Germany");
    expect(params.get("from_lat")).toBe("48.137");
    expect(params.get("to_lon")).toBe("16.373");

    const parsed = parseRoutePointParams(params);
    expect(parsed.startPoint).toEqual({ lat: 48.137, lon: 11.575 });
    expect(parsed.endPoint).toEqual({ lat: 48.208, lon: 16.373 });
  });

  it("buildShareUrl includes origin and query string", () => {
    const url = buildShareUrl("https://example.com", {
      start: "A",
      end: "B",
      startPoint: { lat: 1, lon: 2 },
      endPoint: { lat: 3, lon: 4 },
    });
    expect(url).toMatch(/^https:\/\/example\.com\/\?/);
    expect(url).toContain("from_lat=1");
    expect(url).toContain("to_lon=4");
  });

  it("removes coordinate params when points are cleared", () => {
    const params = buildRouteSearchParams(
      { start: "A", end: "B" },
      new URLSearchParams("from_lat=1&from_lon=2&to_lat=3&to_lon=4"),
    );
    expect(params.has("from_lat")).toBe(false);
    expect(params.has("to_lon")).toBe(false);
  });
});
