import { describe, it, expect } from "vitest";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";

describe("COUNTRY_NAMES", () => {
  it("contains 29 country entries", () => {
    expect(Object.keys(COUNTRY_NAMES)).toHaveLength(29);
  });

  it.each([
    ["DE", "Germany"],
    ["AT", "Austria"],
    ["CZ", "Czech Republic"],
    ["SK", "Slovakia"],
    ["HU", "Hungary"],
    ["SI", "Slovenia"],
    ["CH", "Switzerland"],
    ["HR", "Croatia"],
    ["RO", "Romania"],
    ["BG", "Bulgaria"],
    ["RS", "Serbia"],
    ["FR", "France"],
    ["IT", "Italy"],
    ["GB", "United Kingdom"],
    ["GR", "Greece"],
  ])("maps %s to %s", (code, name) => {
    expect(COUNTRY_NAMES[code]).toBe(name);
  });

  it("returns undefined for an unknown country code", () => {
    expect(COUNTRY_NAMES["ZZ"]).toBeUndefined();
    expect(COUNTRY_NAMES["XX"]).toBeUndefined();
  });
});
