"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

const THEME_STORAGE_KEY = "eurodrive-theme";
const THEME_CHANGE_EVENT = "eurodrive-theme-change";
type ThemeMode = "light" | "dark";

function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
}

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("theme-dark", mode === "dark");
}

function getThemeSnapshot(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  return resolveInitialTheme();
}

function subscribeTheme(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === THEME_STORAGE_KEY) {
      listener();
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  };
}

export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useSyncExternalStore<ThemeMode>(subscribeTheme, getThemeSnapshot, () => "light");
  const switchLabel = theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");
  const currentModeLabel = theme === "dark" ? t("theme.label.light") : t("theme.label.dark");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      aria-label={switchLabel}
      title={switchLabel}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {currentModeLabel}
    </button>
  );
}
