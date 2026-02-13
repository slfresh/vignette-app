import type { CurrencyCode } from "@/types/vignette";

// Manual reference rates for estimate conversion display.
export const EXCHANGE_RATES_LAST_UPDATED = "2026-02-12";

const EUR_PER_CURRENCY_UNIT: Record<CurrencyCode, number> = {
  EUR: 1,
  CHF: 1.06,
  CZK: 0.040,
  HUF: 0.0025,
  BGN: 0.51,
  RSD: 0.0085,
  DKK: 0.134,
  SEK: 0.089,
  GBP: 1.17,
  TRY: 0.028,
};

export function convertCurrencyToEur(amount: number, currency: CurrencyCode): number {
  return amount * EUR_PER_CURRENCY_UNIT[currency];
}
