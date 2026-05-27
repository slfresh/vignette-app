import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { Locale } from "@/lib/i18n/translations";
import type { CountryCode } from "@/types/vignette";

const LOCALE_MAP: Record<Locale, string> = {
  en: "en",
  de: "de",
  tr: "tr",
  pl: "pl",
  ro: "ro",
};

/** Localized country label for UI (falls back to English config names). */
export function getLocalizedCountryName(code: CountryCode, locale: Locale): string {
  try {
    const display = new Intl.DisplayNames([LOCALE_MAP[locale] ?? "en"], { type: "region" });
    return display.of(code) ?? COUNTRY_NAMES[code] ?? code;
  } catch {
    return COUNTRY_NAMES[code] ?? code;
  }
}
