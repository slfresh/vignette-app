import { describe, it, expect } from "vitest";
import { aiChatRequestSchema, aiBriefingRequestSchema } from "@/lib/validation/schemas";

describe("AI request schemas", () => {
  it("accepts valid chat payload", () => {
    const result = aiChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
      routeContext: "Route data",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty chat messages", () => {
    const result = aiChatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("accepts valid briefing payload", () => {
    const result = aiBriefingRequestSchema.safeParse({
      routeCoordinates: [[13, 48], [16, 49]],
      routeResult: {
        countries: [{ countryCode: "DE" }],
        routeGeoJson: { type: "LineString", coordinates: [[13, 48], [16, 49]] },
      },
      locale: "en",
    });
    expect(result.success).toBe(true);
  });

  it("rejects briefing with too few coordinates", () => {
    const result = aiBriefingRequestSchema.safeParse({
      routeCoordinates: [[13, 48]],
      routeResult: {
        countries: [{ countryCode: "DE" }],
        routeGeoJson: { type: "LineString", coordinates: [[13, 48]] },
      },
    });
    expect(result.success).toBe(false);
  });
});
