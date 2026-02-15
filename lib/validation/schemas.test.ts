import { describe, expect, it } from "vitest";
import { routeAnalysisRequestSchema, formatZodErrors, geocodeSuggestQuerySchema } from "./schemas";

describe("routeAnalysisRequestSchema", () => {
  it("accepts a valid minimal request", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich, Germany",
      end: "Vienna, Austria",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full request with all optional fields", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Budapest",
      startPoint: { lat: 48.137, lon: 11.575 },
      endPoint: { lat: 47.498, lon: 19.04 },
      dateISO: "2026-06-15",
      vehicleClass: "PASSENGER_CAR_M1",
      powertrainType: "DIESEL",
      grossWeightKg: 1800,
      axles: 2,
      emissionClass: "EURO_6",
      seats: 5,
      avoidTolls: true,
      channelCrossingPreference: "auto",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty start", () => {
    const result = routeAnalysisRequestSchema.safeParse({ start: "", end: "Berlin" });
    expect(result.success).toBe(false);
  });

  it("rejects empty end", () => {
    const result = routeAnalysisRequestSchema.safeParse({ start: "Berlin", end: "" });
    expect(result.success).toBe(false);
  });

  it("rejects same start and end", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Berlin",
      end: "Berlin",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("different");
    }
  });

  it("rejects same start and end (case-insensitive)", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "berlin",
      end: "BERLIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects start exceeding 180 characters", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "A".repeat(181),
      end: "Berlin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dateISO format", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      dateISO: "June 2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid dateISO format", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      dateISO: "2026-06-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid vehicle class", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      vehicleClass: "TANK",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative gross weight", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      grossWeightKg: -500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects axles out of range", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      axles: 0,
    });
    expect(result.success).toBe(false);

    const result2 = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      axles: 9,
    });
    expect(result2.success).toBe(false);
  });

  it("rejects invalid lat/lon in startPoint", () => {
    const result = routeAnalysisRequestSchema.safeParse({
      start: "Munich",
      end: "Berlin",
      startPoint: { lat: 91, lon: 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe("geocodeSuggestQuerySchema", () => {
  it("accepts a valid query", () => {
    const result = geocodeSuggestQuerySchema.safeParse({ q: "Munich" });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short query", () => {
    const result = geocodeSuggestQuerySchema.safeParse({ q: "M" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-long query", () => {
    const result = geocodeSuggestQuerySchema.safeParse({ q: "A".repeat(121) });
    expect(result.success).toBe(false);
  });
});

describe("formatZodErrors", () => {
  it("joins multiple error messages with semicolons", () => {
    const result = routeAnalysisRequestSchema.safeParse({ start: "", end: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain(";");
    }
  });
});
