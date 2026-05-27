import { describe, expect, it } from "vitest";
import { assertWithinEuropeBounds, isWithinEuropeBounds } from "@/lib/utils/geo";

describe("isWithinEuropeBounds", () => {
  it("accepts Munich, Germany", () => {
    expect(isWithinEuropeBounds({ lat: 48.137, lon: 11.575 })).toBe(true);
  });

  it("rejects Paris, Texas", () => {
    expect(isWithinEuropeBounds({ lat: 33.661, lon: -95.556 })).toBe(false);
  });

  it("throws with descriptive message via assertWithinEuropeBounds", () => {
    expect(() => assertWithinEuropeBounds({ lat: 33.661, lon: -95.556 }, "Paris, Texas")).toThrow(
      /outside the European road network/i,
    );
  });
});
