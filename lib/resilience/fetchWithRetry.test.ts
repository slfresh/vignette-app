import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logging/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okResponse(body: string = "ok"): Response {
  return new Response(body, { status: 200 });
}

function errorResponse(status: number): Response {
  return new Response("error", { status });
}

describe("fetchWithRetry", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Dynamic import so the module picks up our mocked fetch
  async function loadModule() {
    const mod = await import("@/lib/resilience/fetchWithRetry");
    return mod.fetchWithRetry;
  }

  it("returns response on 200 success", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch.mockResolvedValueOnce(okResponse("success"));

    const response = await fetchWithRetry("https://api.example.com/data");

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("returns response on 4xx without retrying", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch.mockResolvedValueOnce(errorResponse(404));

    const response = await fetchWithRetry("https://api.example.com/missing", undefined, {
      maxRetries: 2,
      baseDelayMs: 1,
    });

    expect(response.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retries on 500 status up to maxRetries", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse("recovered"));

    const response = await fetchWithRetry("https://api.example.com/flaky", undefined, {
      maxRetries: 2,
      baseDelayMs: 1,
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on 429 status", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse("ok"));

    const response = await fetchWithRetry("https://api.example.com/rate-limited", undefined, {
      maxRetries: 1,
      baseDelayMs: 1,
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns last response when all retries exhausted on 500", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500));

    const response = await fetchWithRetry("https://api.example.com/down", undefined, {
      maxRetries: 2,
      baseDelayMs: 1,
    });

    // When all retries are exhausted, the last response is returned
    expect(response.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws on network error after retries", async () => {
    const fetchWithRetry = await loadModule();
    const networkError = new Error("Network failure");
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    await expect(
      fetchWithRetry("https://api.example.com/offline", undefined, {
        maxRetries: 2,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow("Network failure");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("returns immediately with maxRetries 0", async () => {
    const fetchWithRetry = await loadModule();
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    // Use a fresh host to avoid circuit breaker state from earlier tests
    const response = await fetchWithRetry("https://fresh-host.example.com/once", undefined, {
      maxRetries: 0,
      baseDelayMs: 1,
    });

    expect(response.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
