import { describe, it, expect } from "vitest";

import { COUNTRY_GUIDES, type CountryGuide } from "@/lib/content/countryGuides";

describe("countryGuides", () => {
  it("COUNTRY_GUIDES is a non-empty array", () => {
    expect(Array.isArray(COUNTRY_GUIDES)).toBe(true);
    expect(COUNTRY_GUIDES.length).toBeGreaterThan(0);
  });

  it("each guide has the required fields", () => {
    for (const guide of COUNTRY_GUIDES) {
      expect(guide).toHaveProperty("code");
      expect(guide).toHaveProperty("name");
      expect(guide).toHaveProperty("slug");
      expect(guide).toHaveProperty("summary");
      expect(guide).toHaveProperty("highlights");
      expect(typeof guide.code).toBe("string");
      expect(typeof guide.name).toBe("string");
      expect(typeof guide.slug).toBe("string");
      expect(typeof guide.summary).toBe("string");
    }
  });

  it("each guide's highlights is a non-empty array of strings", () => {
    for (const guide of COUNTRY_GUIDES) {
      expect(Array.isArray(guide.highlights)).toBe(true);
      expect(guide.highlights.length).toBeGreaterThan(0);
      for (const highlight of guide.highlights) {
        expect(typeof highlight).toBe("string");
      }
    }
  });

  it("all slugs are unique", () => {
    const slugs = COUNTRY_GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all codes are unique", () => {
    const codes = COUNTRY_GUIDES.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(["AT", "CZ", "SK", "HU", "SI", "CH", "RO", "BG", "DE", "HR"])(
    "includes key country %s",
    (code) => {
      const found = COUNTRY_GUIDES.find((g) => g.code === code);
      expect(found).toBeDefined();
    },
  );
});
