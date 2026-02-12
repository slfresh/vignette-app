import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitStoreForTests } from "./rateLimit";

function makeRequest(ip = "203.0.113.10"): Request {
  return new Request("http://localhost/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T00:00:00.000Z"));
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStoreForTests();
  });

  it("allows requests up to the configured limit", async () => {
    const request = makeRequest();
    const first = await checkRateLimit(request, "route-analysis", 2, 60_000);
    const second = await checkRateLimit(request, "route-analysis", 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks requests above the configured limit", async () => {
    const request = makeRequest();
    await checkRateLimit(request, "route-analysis", 1, 60_000);
    const blocked = await checkRateLimit(request, "route-analysis", 1, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets counters after the window passes", async () => {
    const request = makeRequest();
    await checkRateLimit(request, "route-analysis", 1, 60_000);
    const blocked = await checkRateLimit(request, "route-analysis", 1, 60_000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    const allowedAgain = await checkRateLimit(request, "route-analysis", 1, 60_000);
    expect(allowedAgain.allowed).toBe(true);
  });

  it("tracks limits independently per scope", async () => {
    const request = makeRequest();

    const routeAllowed = await checkRateLimit(request, "route-analysis", 1, 60_000);
    const routeBlocked = await checkRateLimit(request, "route-analysis", 1, 60_000);
    const geocodeAllowed = await checkRateLimit(request, "geocode-suggest", 1, 60_000);

    expect(routeAllowed.allowed).toBe(true);
    expect(routeBlocked.allowed).toBe(false);
    expect(geocodeAllowed.allowed).toBe(true);
  });
});
