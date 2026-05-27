"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Locale, SUPPORTED_LOCALES, TRANSLATIONS, type TranslationKey } from "@/lib/i18n/translations";

const LOCALE_STORAGE_KEY = "eurodrive-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Detect the preferred locale from localStorage or browser settings. */
function detectClientLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.some((entry) => entry.code === stored)) {
    return stored as Locale;
  }

  const browser = (window.navigator.language || "en").slice(0, 2).toLowerCase();
  if (SUPPORTED_LOCALES.some((entry) => entry.code === browser)) {
    return browser as Locale;
  }
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always start with "en" to match the server render and avoid hydration mismatch.
  // The real locale is applied in a useEffect after the first client paint.
  const [locale, setLocaleState] = useState<Locale>("en");

  // After hydration, apply the actual client locale
  useEffect(() => {
    const detected = detectClientLocale();
    if (detected !== "en") {
      setLocaleState(detected);
      document.documentElement.lang = detected;
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        // Also set a cookie so the server can read locale for html lang
        document.cookie = `eurodrive-locale=${next};path=/;max-age=31536000;SameSite=Lax`;
      }
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
    };

    const t = (key: TranslationKey) => TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;

    return {
      locale,
      setLocale,
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
