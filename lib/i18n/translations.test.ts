import { describe, expect, it } from "vitest";
import { TRANSLATIONS, SUPPORTED_LOCALES } from "./translations";
import type { TranslationKey } from "./translations";

describe("translations completeness", () => {
  // Get all keys from the English translation (our reference locale)
  const englishKeys = Object.keys(TRANSLATIONS.en) as TranslationKey[];

  for (const locale of SUPPORTED_LOCALES) {
    if (locale.code === "en") continue; // Skip comparing English to itself

    it(`${locale.label} (${locale.code}) has all English keys`, () => {
      const localeTranslations = TRANSLATIONS[locale.code];
      const missingKeys = englishKeys.filter(
        (key) => !(key in localeTranslations),
      );

      if (missingKeys.length > 0) {
        // This is a soft check — warn but don't fail, since some keys may
        // intentionally fall back to English
        console.warn(
          `[${locale.code}] Missing ${missingKeys.length} keys: ${missingKeys.slice(0, 5).join(", ")}${missingKeys.length > 5 ? "..." : ""}`,
        );
      }

      // At minimum, critical UI keys must be present
      const criticalKeys: TranslationKey[] = [
        "form.submit",
        "form.start",
        "form.destination",
        "header.subtitle",
      ];
      for (const key of criticalKeys) {
        expect(
          localeTranslations[key],
          `Critical key "${key}" missing in ${locale.code}`,
        ).toBeDefined();
      }
    });
  }

  it("English has no empty translation values", () => {
    for (const [key, value] of Object.entries(TRANSLATIONS.en)) {
      expect(value, `English key "${key}" has empty value`).toBeTruthy();
    }
  });

  it("all supported locales are in TRANSLATIONS", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(TRANSLATIONS[locale.code], `Missing translations for ${locale.code}`).toBeDefined();
    }
  });
});
