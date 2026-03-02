import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BRAND", () => {
  it("uses default name 'EuroDrive' when NEXT_PUBLIC_BRAND_NAME is not set", async () => {
    const { BRAND } = await import("@/lib/config/branding");

    expect(BRAND.name).toBe("EuroDrive");
    expect(BRAND.subtitle).toBe("European Vignette Portal");
    expect(BRAND.tagline).toBe(
      "Independent route guidance with official toll links.",
    );
  });

  it("reads brand name from NEXT_PUBLIC_BRAND_NAME env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "MyBrand");

    const { BRAND } = await import("@/lib/config/branding");

    expect(BRAND.name).toBe("MyBrand");
  });

  it("trims whitespace from the env var value", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "  SpaceBrand  ");

    const { BRAND } = await import("@/lib/config/branding");

    expect(BRAND.name).toBe("SpaceBrand");
  });

  it("falls back to default when env var is an empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");

    const { BRAND } = await import("@/lib/config/branding");

    expect(BRAND.name).toBe("EuroDrive");
  });
});
