import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadFlags() {
  const { FEATURE_FLAGS } = await import("@/lib/config/featureFlags");
  return FEATURE_FLAGS;
}

describe("FEATURE_FLAGS", () => {
  it("uses correct defaults when no env vars are set", async () => {
    const flags = await loadFlags();

    expect(flags.donationsEnabled).toBe(true);
    expect(flags.insuranceAffiliateEnabled).toBe(false);
    expect(flags.accommodationAffiliateEnabled).toBe(false);
  });

  it('enables a flag when env is set to "true"', async () => {
    vi.stubEnv("FEATURE_INSURANCE_AFFILIATE_ENABLED", "true");

    const flags = await loadFlags();

    expect(flags.insuranceAffiliateEnabled).toBe(true);
  });

  it('enables a flag when env is set to "1"', async () => {
    vi.stubEnv("FEATURE_ACCOMMODATION_AFFILIATE_ENABLED", "1");

    const flags = await loadFlags();

    expect(flags.accommodationAffiliateEnabled).toBe(true);
  });

  it('disables a flag when env is set to "false"', async () => {
    vi.stubEnv("FEATURE_DONATIONS_ENABLED", "false");

    const flags = await loadFlags();

    expect(flags.donationsEnabled).toBe(false);
  });

  it('disables a flag when env is set to "0"', async () => {
    vi.stubEnv("FEATURE_DONATIONS_ENABLED", "0");

    const flags = await loadFlags();

    expect(flags.donationsEnabled).toBe(false);
  });

  it("falls back to default for invalid / unrecognized values", async () => {
    vi.stubEnv("FEATURE_DONATIONS_ENABLED", "yes");
    vi.stubEnv("FEATURE_INSURANCE_AFFILIATE_ENABLED", "nope");

    const flags = await loadFlags();

    expect(flags.donationsEnabled).toBe(true);
    expect(flags.insuranceAffiliateEnabled).toBe(false);
  });
});
