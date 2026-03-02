import { describe, it, expect, vi, afterEach } from "vitest";
import { validateEnv } from "@/lib/config/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validateEnv", () => {
  it("throws when ORS_API_KEY is missing", () => {
    vi.stubEnv("ORS_API_KEY", "");

    expect(() => validateEnv()).toThrow("Missing required environment variables");
  });

  it("returns env when ORS_API_KEY is present", () => {
    vi.stubEnv("ORS_API_KEY", "test-key-123");

    const env = validateEnv();

    expect(env.ORS_API_KEY).toBe("test-key-123");
  });

  it("warns but does not throw when optional vars have an invalid format", () => {
    vi.stubEnv("ORS_API_KEY", "test-key-123");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "not-a-valid-url");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Optional environment variable warnings"),
    );
  });

  it("returns typed env with all valid optional vars", () => {
    vi.stubEnv("ORS_API_KEY", "test-key-123");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-abc");
    vi.stubEnv("APP_PUBLIC_URL", "https://app.example.com");

    const env = validateEnv();

    expect(env.ORS_API_KEY).toBe("test-key-123");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("token-abc");
    expect(env.APP_PUBLIC_URL).toBe("https://app.example.com");
  });
});
