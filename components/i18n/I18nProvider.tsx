"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { Locale, SUPPORTED_LOCALES, TRANSLATIONS, type TranslationKey } from "@/lib/i18n/translations";

const LOCALE_STORAGE_KEY = "eurodrive-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const localeListeners = new Set<() => void>();

/** Detect the preferred locale from localStorage or browser settings. */
function detectClientLocale(): Locale {
  if (typeof window === "undefined") return "en";
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

function subscribeLocale(onStoreChange: () => void) {
  localeListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    localeListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getClientLocaleSnapshot(): Locale {
  return detectClientLocale();
}

function useClientLocale(): Locale {
  return useSyncExternalStore(
    subscribeLocale,
    getClientLocaleSnapshot,
    () => "en",
  );
}

function persistLocale(next: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  document.cookie = `eurodrive-locale=${next};path=/;max-age=31536000;SameSite=Lax`;
  document.documentElement.lang = next;
  localeListeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useClientLocale();

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (next: Locale) => {
      persistLocale(next);
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
