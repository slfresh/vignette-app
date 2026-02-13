"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Locale, SUPPORTED_LOCALES, TRANSLATIONS, type TranslationKey } from "@/lib/i18n/translations";

const LOCALE_STORAGE_KEY = "eurodrive-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

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
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale());

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
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
