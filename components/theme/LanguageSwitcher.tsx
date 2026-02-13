"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "@/lib/i18n/translations";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700">
      {SUPPORTED_LOCALES.map((entry) => (
        <button
          key={entry.code}
          type="button"
          onClick={() => setLocale(entry.code)}
          className={`rounded px-1.5 py-0.5 transition-colors ${
            locale === entry.code ? "bg-blue-100 text-blue-800" : "hover:bg-zinc-100"
          }`}
          title={entry.label}
          aria-label={`Switch language to ${entry.label}`}
        >
          {entry.flag}
        </button>
      ))}
    </div>
  );
}
