import { TRANSLATIONS, type Locale, type TranslationKey } from "@/lib/i18n/translations";

/** Resolve a translation key with optional `{var}` placeholders. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  let text = TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
