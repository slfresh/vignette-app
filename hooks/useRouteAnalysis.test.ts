/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRouteAnalysis } from "@/hooks/useRouteAnalysis";

describe("useRouteAnalysis", () => {
  const router = { replace: vi.fn() };
  const searchParams = new URLSearchParams();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submitRoute stores result on success", async () => {
    const mockResult = {
      countries: [{ countryCode: "DE", requiresVignette: false, requiresSectionToll: false, highwayDistanceMeters: 1000, notices: [] }],
      sectionTolls: [],
      compliance: { official_source: true, informational_only: true, price_last_verified_at: "2026-01-01" },
      routeGeoJson: { type: "LineString", coordinates: [[13, 48], [14, 49]] },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      }),
    );

    const { result } = renderHook(() => useRouteAnalysis(router, searchParams));

    await act(async () => {
      await result.current.submitRoute({ start: "Munich", end: "Vienna" });
    });

    expect(result.current.result).toEqual(mockResult);
    expect(result.current.loading).toBe(false);
    expect(router.replace).toHaveBeenCalled();
  });

  it("fetchAlternativeRoute returns null when no prior payload", async () => {
    const { result } = renderHook(() => useRouteAnalysis(router, searchParams));
    let alt = null;
    await act(async () => {
      alt = await result.current.fetchAlternativeRoute(true);
    });
    expect(alt).toBeNull();
  });
});
