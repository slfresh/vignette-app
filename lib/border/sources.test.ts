import { describe, it, expect } from "vitest";
import { getBorderWaitSources, getRouteCrossingSources } from "@/lib/border/sources";
import type { CountryCode } from "@/types/vignette";

describe("getBorderWaitSources", () => {
  it("returns entries for HU, RS, BG", () => {
    const sources = getBorderWaitSources(["HU", "RS", "BG"] as CountryCode[]);
    const codes = sources.map((s) => s.countryCode);
    expect(codes).toContain("HU");
    expect(codes).toContain("RS");
    expect(codes).toContain("BG");
  });

  it("returns empty for countries without links", () => {
    const sources = getBorderWaitSources(["DE", "CZ"] as CountryCode[]);
    expect(sources).toEqual([]);
  });

  it("deduplicates repeated country codes", () => {
    const sources = getBorderWaitSources(["HU", "HU", "HU"] as CountryCode[]);
    expect(sources.length).toBe(1);
  });
});

describe("getRouteCrossingSources", () => {
  it("returns sources for HU-RS route", () => {
    const sources = getRouteCrossingSources(["HU", "RS"] as CountryCode[]);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].crossingCode).toBe("HU-RS");
  });

  it("returns empty for fewer than 2 countries", () => {
    const sources = getRouteCrossingSources(["HU"] as CountryCode[]);
    expect(sources).toEqual([]);
  });

  it("handles reverse order (RS-HU same as HU-RS)", () => {
    const forward = getRouteCrossingSources(["HU", "RS"] as CountryCode[]);
    const reverse = getRouteCrossingSources(["RS", "HU"] as CountryCode[]);
    expect(forward.length).toBe(reverse.length);
    expect(forward.map((s) => s.url).sort()).toEqual(reverse.map((s) => s.url).sort());
  });
});
