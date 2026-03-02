import { describe, expect, it } from "vitest";
import { parseCoordinates, normalizePoint, wrapLongitude } from "./geocode";

describe("parseCoordinates", () => {
  it("parses valid lat,lon string", () => {
    const point = parseCoordinates("48.137, 11.575");
    expect(point).toEqual({ lat: 48.137, lon: 11.575 });
  });

  it("parses without spaces", () => {
    const point = parseCoordinates("48.137,11.575");
    expect(point).toEqual({ lat: 48.137, lon: 11.575 });
  });

  it("returns null for non-coordinate strings", () => {
    expect(parseCoordinates("Munich, Germany")).toBeNull();
  });

  it("returns null for single value", () => {
    expect(parseCoordinates("48.137")).toBeNull();
  });

  it("returns null for out-of-range latitude", () => {
    expect(parseCoordinates("91, 11.575")).toBeNull();
    expect(parseCoordinates("-91, 11.575")).toBeNull();
  });

  it("wraps out-of-range longitude back to valid range", () => {
    expect(parseCoordinates("48.137, 181")).toEqual({ lat: 48.137, lon: -179 });
    expect(parseCoordinates("48.137, -181")).toEqual({ lat: 48.137, lon: 179 });
  });

  it("returns null for NaN values", () => {
    expect(parseCoordinates("abc, def")).toBeNull();
  });

  it("handles negative coordinates", () => {
    const point = parseCoordinates("-33.8688, 151.2093");
    expect(point).toEqual({ lat: -33.8688, lon: 151.2093 });
  });
});

describe("wrapLongitude", () => {
  it("leaves valid longitudes unchanged", () => {
    expect(wrapLongitude(11.5)).toBe(11.5);
    expect(wrapLongitude(-180)).toBe(-180);
    expect(wrapLongitude(180)).toBe(180);
    expect(wrapLongitude(0)).toBe(0);
  });

  it("wraps positive overflow", () => {
    expect(wrapLongitude(181)).toBe(-179);
    expect(wrapLongitude(360)).toBe(0);
    expect(wrapLongitude(541)).toBe(-179);
  });

  it("wraps negative overflow", () => {
    expect(wrapLongitude(-181)).toBe(179);
    expect(wrapLongitude(-360)).toBe(0);
  });
});

describe("normalizePoint", () => {
  it("returns null for undefined", () => {
    expect(normalizePoint(undefined)).toBeNull();
  });

  it("returns null for NaN coordinates", () => {
    expect(normalizePoint({ lat: NaN, lon: 11 })).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(normalizePoint({ lat: Infinity, lon: 11 })).toBeNull();
  });

  it("returns null for out-of-range lat", () => {
    expect(normalizePoint({ lat: 91, lon: 11 })).toBeNull();
  });

  it("wraps out-of-range longitude instead of rejecting", () => {
    const result = normalizePoint({ lat: 48.137, lon: 200 });
    expect(result).toEqual({ lat: 48.137, lon: -160 });
  });

  it("returns a clean point for valid input", () => {
    const result = normalizePoint({ lat: 48.137, lon: 11.575 });
    expect(result).toEqual({ lat: 48.137, lon: 11.575 });
  });
});
