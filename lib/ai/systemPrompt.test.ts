import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";

describe("SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof SYSTEM_PROMPT).toBe("string");
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it.each([
    "EuroDrive AI",
    "vignette",
    "IMPORTANT RULES",
    "Austria",
    "Switzerland",
  ])('contains key phrase "%s"', (phrase) => {
    expect(SYSTEM_PROMPT).toContain(phrase);
  });
});
