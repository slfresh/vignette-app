export interface LegalOperatorProfile {
  fullName: string;
  streetAddress: string;
  email: string;
  phone: string;
  vatId: string;
}

const DEFAULTS: LegalOperatorProfile = {
  fullName: "REPLACE_WITH_FULL_NAME",
  streetAddress: "REPLACE_WITH_LEGAL_ADDRESS",
  email: "REPLACE_WITH_EMAIL",
  phone: "REPLACE_WITH_PHONE",
  vatId: "REPLACE_WITH_VAT_ID_OR_NA",
};

function envValue(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function getLegalOperatorProfile(): LegalOperatorProfile {
  return {
    fullName: envValue("LEGAL_FULL_NAME", DEFAULTS.fullName),
    streetAddress: envValue("LEGAL_STREET_ADDRESS", DEFAULTS.streetAddress),
    email: envValue("LEGAL_EMAIL", DEFAULTS.email),
    phone: envValue("LEGAL_PHONE", DEFAULTS.phone),
    vatId: envValue("LEGAL_VAT_ID", DEFAULTS.vatId),
  };
}

export function hasPlaceholderLegalProfile(profile: LegalOperatorProfile): boolean {
  return Object.values(profile).some((value) => value.startsWith("REPLACE_WITH_"));
}
