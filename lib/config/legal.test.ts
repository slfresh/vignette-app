import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getLegalOperatorProfile,
  hasPlaceholderLegalProfile,
  assertLegalProfileConfigured,
} from "@/lib/config/legal";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getLegalOperatorProfile", () => {
  it("returns placeholder defaults when env vars are empty", () => {
    const profile = getLegalOperatorProfile();

    expect(profile.fullName).toBe("REPLACE_WITH_FULL_NAME");
    expect(profile.streetAddress).toBe("REPLACE_WITH_LEGAL_ADDRESS");
    expect(profile.email).toBe("REPLACE_WITH_EMAIL");
    expect(profile.phone).toBe("REPLACE_WITH_PHONE");
    expect(profile.vatId).toBe("REPLACE_WITH_VAT_ID_OR_NA");
  });

  it("reads values from env vars when they are set", () => {
    vi.stubEnv("LEGAL_FULL_NAME", "Acme Corp");
    vi.stubEnv("LEGAL_STREET_ADDRESS", "123 Main St");
    vi.stubEnv("LEGAL_EMAIL", "contact@acme.com");
    vi.stubEnv("LEGAL_PHONE", "+1-555-0100");
    vi.stubEnv("LEGAL_VAT_ID", "DE123456789");

    const profile = getLegalOperatorProfile();

    expect(profile.fullName).toBe("Acme Corp");
    expect(profile.streetAddress).toBe("123 Main St");
    expect(profile.email).toBe("contact@acme.com");
    expect(profile.phone).toBe("+1-555-0100");
    expect(profile.vatId).toBe("DE123456789");
  });
});

describe("hasPlaceholderLegalProfile", () => {
  it("returns true when profile contains placeholder values", () => {
    const profile = getLegalOperatorProfile();
    expect(hasPlaceholderLegalProfile(profile)).toBe(true);
  });

  it("returns false when all values are real", () => {
    const profile = {
      fullName: "Acme Corp",
      streetAddress: "123 Main St",
      email: "contact@acme.com",
      phone: "+1-555-0100",
      vatId: "DE123456789",
    };
    expect(hasPlaceholderLegalProfile(profile)).toBe(false);
  });
});

describe("assertLegalProfileConfigured", () => {
  it("does nothing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => assertLegalProfileConfigured()).not.toThrow();
  });

  it("throws in production when profile has placeholders", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => assertLegalProfileConfigured()).toThrow("[FATAL]");
  });

  it("warns instead of throwing when CI env var is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CI", "true");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => assertLegalProfileConfigured()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[WARN] Legal profile has placeholder values"),
    );

    warnSpy.mockRestore();
  });

  it("does nothing in production when env is fully configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEGAL_FULL_NAME", "Acme Corp");
    vi.stubEnv("LEGAL_STREET_ADDRESS", "123 Main St");
    vi.stubEnv("LEGAL_EMAIL", "contact@acme.com");
    vi.stubEnv("LEGAL_PHONE", "+1-555-0100");
    vi.stubEnv("LEGAL_VAT_ID", "DE123456789");

    expect(() => assertLegalProfileConfigured()).not.toThrow();
  });
});
