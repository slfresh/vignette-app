"use client";

import { Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { RecentSearch } from "@/lib/storage/recentSearches";
import { clearRecentSearches } from "@/lib/storage/recentSearches";

interface GeocodeSuggestion {
  label: string;
  lat: number;
  lon: number;
}

function getLocalizedNameHint(query: string, label: string): string | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "osijek" && /\besseg\b/i.test(label)) {
    return "Osijek, localized historical name";
  }
  return null;
}

function extractHouseNumber(value: string): string | null {
  const match = value.match(/\b\d+[a-zA-Z]?\b/);
  return match ? match[0].toLowerCase() : null;
}

function hasExactHouseNumberMatch(value: string, suggestions: GeocodeSuggestion[]): boolean {
  const houseNumber = extractHouseNumber(value);
  if (!houseNumber) return true;
  return suggestions.some((suggestion) => suggestion.label.toLowerCase().includes(houseNumber));
}

interface AddressInputProps {
  /** "A" or "B" marker label */
  marker: string;
  /** Color class for the marker circle */
  markerColor: string;
  /** i18n key for the field label */
  labelKey: TranslationKey;
  /** i18n key for the placeholder */
  placeholderKey: TranslationKey;
  /** Unique id prefix for the listbox ("start" or "end") */
  idPrefix: string;
  /** Current text value */
  value: string;
  /** Called when the user types */
  onChange: (value: string) => void;
  /** Selected geocoded point (if any) */
  selectedPoint: { lat: number; lon: number } | undefined;
  /** Current suggestions from autocomplete */
  suggestions: GeocodeSuggestion[];
  /** Active keyboard-navigated suggestion index */
  activeIndex: number;
  /** Update the active suggestion index */
  onActiveIndexChange: (index: number) => void;
  /** Called when the user selects a suggestion (click, Enter, or recent search) */
  onSelectSuggestion: (suggestion: GeocodeSuggestion) => void;
  /** Called to clear suggestions */
  onClearSuggestions: () => void;
  /** Called to clear the selected point and suggestions (for "use typed address") */
  onClearPoint: () => void;
  /** Whether this input is currently focused */
  focused: boolean;
  /** Focus change callback */
  onFocusChange: (focused: boolean) => void;
  /** Recent searches for dropdown */
  recentSearches: RecentSearch[];
  /** Called when user clears recent searches */
  onClearRecentSearches: () => void;
  /** CSS class for the input element */
  inputClassName: string;
}

export function AddressInput({
  marker,
  markerColor,
  labelKey,
  placeholderKey,
  idPrefix,
  value,
  onChange,
  selectedPoint,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelectSuggestion,
  onClearSuggestions,
  onClearPoint,
  focused,
  onFocusChange,
  recentSearches,
  onClearRecentSearches,
  inputClassName,
}: AddressInputProps) {
  const { t } = useI18n();

  const needsApproximateMatchWarning =
    value.trim().length >= 3 &&
    extractHouseNumber(value) &&
    suggestions.length > 0 &&
    !hasExactHouseNumberMatch(value, suggestions);

  return (
    <div className="relative grid gap-1.5 text-sm">
      <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${markerColor} text-[10px] font-bold text-white`} aria-hidden>
          {marker}
        </span>
        {t(labelKey)}
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={`${idPrefix}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${idPrefix}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          className={inputClassName}
          placeholder={t(placeholderKey)}
          value={value}
          onFocus={() => onFocusChange(true)}
          onBlur={() => setTimeout(() => onFocusChange(false), 150)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!suggestions.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onActiveIndexChange((activeIndex + 1) % suggestions.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onActiveIndexChange(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
              return;
            }
            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              const suggestion = suggestions[activeIndex];
              if (suggestion) onSelectSuggestion(suggestion);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onClearSuggestions();
              onActiveIndexChange(-1);
            }
          }}
        />
      </div>

      {/* Autocomplete suggestions dropdown */}
      {suggestions.length > 0 && (
        <div id={`${idPrefix}-listbox`} role="listbox" className="absolute left-0 right-0 top-[100%] z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-surface shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              id={`${idPrefix}-option-${index}`}
              key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted ${
                index === activeIndex ? "bg-surface-muted text-[var(--accent)]" : ""
              }`}
              onMouseEnter={() => onActiveIndexChange(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectSuggestion(suggestion);
              }}
            >
              {suggestion.label}
              {getLocalizedNameHint(value, suggestion.label) ? (
                <span className="ml-2 text-xs text-[var(--text-muted)]">({getLocalizedNameHint(value, suggestion.label)})</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Recent searches dropdown */}
      {focused && !suggestions.length && !selectedPoint && value.trim().length < 2 && recentSearches.length > 0 && (
        <div className="absolute left-0 right-0 top-[100%] z-20 mt-1 overflow-auto rounded-lg border border-[var(--border)] bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {t("recentSearches.title")}
            </span>
            <button
              type="button"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
              onMouseDown={(e) => {
                e.preventDefault();
                onClearRecentSearches();
              }}
            >
              {t("recentSearches.clear")}
            </button>
          </div>
          {recentSearches.map((item) => (
            <button
              key={`recent-${idPrefix}-${item.label}-${item.lat}-${item.lon}`}
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectSuggestion({ label: item.label, lat: item.lat, lon: item.lon });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {selectedPoint && <p className="text-xs font-medium text-[var(--accent-green)]">{t("form.selectedAddressLocked")}</p>}

      {needsApproximateMatchWarning && (
        <div className="mt-1 rounded-lg border border-[var(--accent)]/30 bg-[#FDF6EC] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          {t("form.approxWarning")}
          <button type="button" className="ml-2 font-medium underline" onClick={onClearPoint}>
            {t("form.useTypedAddress")}
          </button>
        </div>
      )}
    </div>
  );
}
