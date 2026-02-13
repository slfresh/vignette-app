import type { CountryCode } from "@/types/vignette";

// Indicative per-trip section toll estimates (EUR) for route budgeting.
export const SECTION_TOLL_ESTIMATES_LAST_UPDATED = "2026-02-12";

export const SECTION_TOLL_ESTIMATE_EUR: Partial<Record<CountryCode, number>> = {
  AT: 12.5,
  RO: 4.0,
  DK: 25.0,
  SE: 30.0,
  HR: 18.0,
  RS: 14.0,
  FR: 28.0,
  IT: 30.0,
  BA: 7.0,
  ME: 5.0,
  MK: 8.0,
  AL: 5.0,
  PL: 14.0,
  ES: 12.0,
  PT: 11.0,
  GB: 18.0,
  IE: 8.0,
  TR: 15.0,
  GR: 14.0,
};
