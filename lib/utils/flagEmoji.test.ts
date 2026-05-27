import { describe, it, expect } from "vitest";
import { getFlagEmoji } from "@/lib/utils/flagEmoji";

describe("getFlagEmoji", () => {
  it("returns flag emoji for valid ISO codes", () => {
    expect(getFlagEmoji("DE")).toBe("🇩🇪");
    expect(getFlagEmoji("hr")).toBe("🇭🇷");
  });

  it("returns white flag for invalid codes", () => {
    expect(getFlagEmoji("DEU")).toBe("🏳️");
    expect(getFlagEmoji("")).toBe("🏳️");
  });
});
