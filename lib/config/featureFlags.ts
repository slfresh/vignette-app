function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export const FEATURE_FLAGS = {
  /** Show donation/tip jar buttons */
  donationsEnabled: envBool("FEATURE_DONATIONS_ENABLED", true),

  /** Show insurance affiliate panel */
  insuranceAffiliateEnabled: envBool("FEATURE_INSURANCE_AFFILIATE_ENABLED", false),

  /** Show accommodation affiliate panel */
  accommodationAffiliateEnabled: envBool("FEATURE_ACCOMMODATION_AFFILIATE_ENABLED", false),
} as const;
