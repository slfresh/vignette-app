"use client";

import { Bike, Car, ChevronDown, Info, Loader2, Search, Send, Settings, Truck } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { EmissionClass, PowertrainType, RoutePoint, VehicleClass } from "@/types/vignette";
import { getRecentSearches, addRecentSearch, clearRecentSearches, type RecentSearch } from "@/lib/storage/recentSearches";

interface GeocodeSuggestion {
  label: string;
  lat: number;
  lon: number;
}

const STORAGE_KEY = "eurodrive_form_prefs";

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
  if (!houseNumber) {
    return true;
  }
  return suggestions.some((suggestion) => suggestion.label.toLowerCase().includes(houseNumber));
}

interface RouteFormProps {
  onSubmit: (payload: {
    start: string;
    end: string;
    startPoint?: RoutePoint;
    endPoint?: RoutePoint;
    dateISO?: string;
    seats?: number;
    vehicleClass?: VehicleClass;
    powertrainType?: PowertrainType;
    grossWeightKg?: number;
    axles?: number;
    emissionClass?: EmissionClass;
    avoidTolls?: boolean;
    channelCrossingPreference?: "auto" | "ferry" | "tunnel";
  }) => Promise<void>;
  /** Pre-fill from URL (e.g. shared link) */
  initialStart?: string;
  initialEnd?: string;
  /** Disable submit while parent is loading (e.g. auto-submit from URL) */
  isSubmitting?: boolean;
  /** Called when start/end or points change – used to sync with map picker markers */
  onValuesChange?: (values: { start: string; end: string; startPoint?: RoutePoint; endPoint?: RoutePoint }) => void;
}

export type RouteFormHandle = {
  setStartFromMap: (label: string, point: RoutePoint) => void;
  setEndFromMap: (label: string, point: RoutePoint) => void;
  /** Programmatically submit the form (used by auto-calculate). */
  submit: () => void;
};

export const RouteForm = forwardRef<RouteFormHandle, RouteFormProps>(function RouteForm(
  { onSubmit, initialStart = "", initialEnd = "", isSubmitting = false, onValuesChange }: RouteFormProps,
  ref,
) {
  const { t } = useI18n();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [startPoint, setStartPoint] = useState<RoutePoint | undefined>(undefined);
  const [endPoint, setEndPoint] = useState<RoutePoint | undefined>(undefined);
  const [startSuggestions, setStartSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [activeStartSuggestionIndex, setActiveStartSuggestionIndex] = useState(-1);
  const [activeEndSuggestionIndex, setActiveEndSuggestionIndex] = useState(-1);
  const [dateISO, setDateISO] = useState("");
  const [seats, setSeats] = useState<number>(5);
  const [grossWeightKgInput, setGrossWeightKgInput] = useState<string>("");
  const [axles, setAxles] = useState<number>(2);
  const [emissionClass, setEmissionClass] = useState<EmissionClass>("UNKNOWN");
  const [vehicleType, setVehicleType] = useState<"car" | "motorcycle" | "camper">("car");
  const [powertrainType, setPowertrainType] = useState<PowertrainType>("PETROL");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [channelCrossingPreference, setChannelCrossingPreference] = useState<"auto" | "ferry" | "tunnel">("auto");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);
  const formElRef = useRef<HTMLFormElement>(null);
  const [startFocused, setStartFocused] = useState(false);
  const [endFocused, setEndFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const isMotorcycle = vehicleType === "motorcycle";
  const startNeedsApproximateMatchWarning =
    start.trim().length >= 3 && extractHouseNumber(start) && startSuggestions.length > 0 && !hasExactHouseNumberMatch(start, startSuggestions);
  const endNeedsApproximateMatchWarning =
    end.trim().length >= 3 && extractHouseNumber(end) && endSuggestions.length > 0 && !hasExactHouseNumberMatch(end, endSuggestions);

  function toVehicleClass(value: "car" | "motorcycle" | "camper"): VehicleClass {
    if (value === "motorcycle") {
      return "MOTORCYCLE";
    }
    if (value === "camper") {
      return "VAN_OR_MPV";
    }
    return "PASSENGER_CAR_M1";
  }

  function applyStartSuggestion(suggestion: GeocodeSuggestion) {
    setStart(suggestion.label);
    setStartPoint({ lat: suggestion.lat, lon: suggestion.lon });
    setStartSuggestions([]);
    setActiveStartSuggestionIndex(-1);
    addRecentSearch({ label: suggestion.label, lat: suggestion.lat, lon: suggestion.lon });
    setRecentSearches(getRecentSearches());
  }

  function applyEndSuggestion(suggestion: GeocodeSuggestion) {
    setEnd(suggestion.label);
    setEndPoint({ lat: suggestion.lat, lon: suggestion.lon });
    setEndSuggestions([]);
    setActiveEndSuggestionIndex(-1);
    addRecentSearch({ label: suggestion.label, lat: suggestion.lat, lon: suggestion.lon });
    setRecentSearches(getRecentSearches());
  }

  // Load vehicle and powertrain preferences from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { vehicleType?: string; powertrainType?: string };
      if (parsed.vehicleType && ["car", "motorcycle", "camper"].includes(parsed.vehicleType)) {
        setVehicleType(parsed.vehicleType as "car" | "motorcycle" | "camper");
      }
      if (parsed.powertrainType && ["PETROL", "DIESEL", "ELECTRIC", "HYBRID"].includes(parsed.powertrainType)) {
        setPowertrainType(parsed.powertrainType as PowertrainType);
      }
    } catch {
      // Ignore invalid or corrupted localStorage
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicleType, powertrainType }));
    } catch {
      // localStorage full or disabled
    }
  }, [vehicleType, powertrainType]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useImperativeHandle(ref, () => ({
    setStartFromMap: (label: string, point: RoutePoint) => {
      setStart(label);
      setStartPoint(point);
      setStartSuggestions([]);
      addRecentSearch({ label, lat: point.lat, lon: point.lon });
      setRecentSearches(getRecentSearches());
    },
    setEndFromMap: (label: string, point: RoutePoint) => {
      setEnd(label);
      setEndPoint(point);
      setEndSuggestions([]);
      addRecentSearch({ label, lat: point.lat, lon: point.lon });
      setRecentSearches(getRecentSearches());
    },
    submit: () => {
      formElRef.current?.requestSubmit();
    },
  }));

  useEffect(() => {
    onValuesChange?.({ start, end, startPoint, endPoint });
  }, [start, end, startPoint, endPoint, onValuesChange]);

  useEffect(() => {
    if (startPoint) {
      setStartSuggestions([]);
      return;
    }
    const query = start.trim();
    if (query.length < 2) {
      setStartSuggestions([]);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { suggestions?: GeocodeSuggestion[] };
        setStartSuggestions(body.suggestions ?? []);
      } catch {
        if (!abortController.signal.aborted) {
          setStartSuggestions([]);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [start, startPoint]);

  useEffect(() => {
    setActiveStartSuggestionIndex(-1);
  }, [startSuggestions]);

  useEffect(() => {
    if (endPoint) {
      setEndSuggestions([]);
      return;
    }
    const query = end.trim();
    if (query.length < 2) {
      setEndSuggestions([]);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { suggestions?: GeocodeSuggestion[] };
        setEndSuggestions(body.suggestions ?? []);
      } catch {
        if (!abortController.signal.aborted) {
          setEndSuggestions([]);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [end, endPoint]);

  useEffect(() => {
    setActiveEndSuggestionIndex(-1);
  }, [endSuggestions]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Debounce: ignore rapid repeated clicks (within 1 second)
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 1000) return;
    lastSubmitTimeRef.current = now;

    if (!start.trim() || !end.trim()) {
      setError(t("form.error.startEndRequired"));
      return;
    }

    const grossWeightKg = grossWeightKgInput.trim().length ? Number(grossWeightKgInput) : undefined;
    if (!isMotorcycle && grossWeightKg !== undefined && (!Number.isFinite(grossWeightKg) || grossWeightKg <= 0)) {
      setError(t("form.error.grossWeight"));
      return;
    }
    if (!isMotorcycle && (!Number.isFinite(axles) || axles < 1 || axles > 8)) {
      setError(t("form.error.axles"));
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        start: start.trim(),
        end: end.trim(),
        startPoint,
        endPoint,
        dateISO: dateISO || undefined,
        seats: isMotorcycle ? undefined : seats,
        vehicleClass: toVehicleClass(vehicleType),
        powertrainType,
        grossWeightKg: isMotorcycle ? undefined : grossWeightKg,
        axles: isMotorcycle ? undefined : axles,
        emissionClass: powertrainType === "ELECTRIC" ? "ZERO_EMISSION" : isMotorcycle ? "UNKNOWN" : emissionClass,
        avoidTolls,
        channelCrossingPreference,
      });
    } catch {
      // API/network errors are handled by the parent page component.
      // The form only displays its own local validation errors (set above).
    } finally {
      setLoading(false);
    }
  }

  /* Vehicle cards config – emoji + metadata for the 2-column grid */
  const vehicleCards: {
    value: "car" | "motorcycle" | "camper";
    emoji: string;
    labelKey: TranslationKey;
    meta: string;
    icon: typeof Car;
  }[] = [
    { value: "car", emoji: "\uD83D\uDE97", labelKey: "form.vehicle.car", meta: `2 \u2022 ${emissionClass === "EURO_6" || emissionClass === "UNKNOWN" ? "EURO 6" : "EURO 5"}`, icon: Car },
    { value: "motorcycle", emoji: "\uD83C\uDFCD\uFE0F", labelKey: "form.vehicle.motorcycle", meta: "2 \u2022 EURO 5", icon: Bike },
    { value: "camper", emoji: "\uD83D\uDE90", labelKey: "form.vehicle.camper", meta: `${axles}+ \u2022 EURO 6`, icon: Truck },
  ];

  const inputClasses = "w-full rounded-lg border border-[var(--border)] bg-surface py-2.5 pl-10 pr-3 text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20";
  const selectClasses = "rounded-lg border border-[var(--border)] bg-surface px-3 py-2.5 text-sm transition-colors focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20";
  const advancedInputClasses = "rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20";

  return (
    <form ref={formElRef} onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-lg backdrop-blur-sm lg:bg-surface/95">
      {/* Warm header */}
      <div className="border-b border-[var(--border)] bg-surface-muted px-5 py-4">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
          <Send className="h-4 w-4 text-[var(--accent)]" />
          {t("form.title")}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("form.subtitle")}</p>
      </div>

      <div className="grid gap-5 p-5">
        {/* ─── Origin ─── */}
        <div className="relative grid gap-1.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-green)] text-[10px] font-bold text-white" aria-hidden>A</span>
            {t("form.start")}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              role="combobox"
              aria-expanded={startSuggestions.length > 0}
              aria-controls="start-listbox"
              aria-activedescendant={activeStartSuggestionIndex >= 0 ? `start-option-${activeStartSuggestionIndex}` : undefined}
              aria-autocomplete="list"
              className={inputClasses}
              placeholder={t("form.startPlaceholder")}
              value={start}
              onFocus={() => setStartFocused(true)}
              onBlur={() => setTimeout(() => setStartFocused(false), 150)}
              onChange={(event) => {
                setStart(event.target.value);
                setStartPoint(undefined);
              }}
              onKeyDown={(event) => {
                if (!startSuggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveStartSuggestionIndex((previous) => (previous + 1) % startSuggestions.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveStartSuggestionIndex((previous) => (previous <= 0 ? startSuggestions.length - 1 : previous - 1));
                  return;
                }
                if (event.key === "Enter" && activeStartSuggestionIndex >= 0) {
                  event.preventDefault();
                  const suggestion = startSuggestions[activeStartSuggestionIndex];
                  if (suggestion) applyStartSuggestion(suggestion);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setStartSuggestions([]);
                  setActiveStartSuggestionIndex(-1);
                }
              }}
            />
          </div>
          {startSuggestions.length ? (
            <div id="start-listbox" role="listbox" className="absolute left-0 right-0 top-[100%] z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-surface shadow-lg">
              {startSuggestions.map((suggestion, index) => (
                <button
                  id={`start-option-${index}`}
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeStartSuggestionIndex}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted ${
                    index === activeStartSuggestionIndex ? "bg-surface-muted text-[var(--accent)]" : ""
                  }`}
                  onMouseEnter={() => setActiveStartSuggestionIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyStartSuggestion(suggestion);
                  }}
                >
                  {suggestion.label}
                  {getLocalizedNameHint(start, suggestion.label) ? (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({getLocalizedNameHint(start, suggestion.label)})</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {/* Recent searches: shown when input focused, empty, and no autocomplete results */}
          {startFocused && !startSuggestions.length && !startPoint && start.trim().length < 2 && recentSearches.length > 0 ? (
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
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                >
                  {t("recentSearches.clear")}
                </button>
              </div>
              {recentSearches.map((item) => (
                <button
                  key={`recent-start-${item.label}-${item.lat}-${item.lon}`}
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyStartSuggestion({ label: item.label, lat: item.lat, lon: item.lon });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {startPoint ? <p className="text-xs font-medium text-[var(--accent-green)]">{t("form.selectedAddressLocked")}</p> : null}
          {startNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-lg border border-[var(--accent)]/30 bg-[#FDF6EC] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              {t("form.approxWarning")}
              <button type="button" className="ml-2 font-medium underline" onClick={() => { setStartPoint(undefined); setStartSuggestions([]); }}>
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </div>

        {/* ─── Destination ─── */}
        <div className="relative grid gap-1.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-red)] text-[10px] font-bold text-white" aria-hidden>B</span>
            {t("form.destination")}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              role="combobox"
              aria-expanded={endSuggestions.length > 0}
              aria-controls="end-listbox"
              aria-activedescendant={activeEndSuggestionIndex >= 0 ? `end-option-${activeEndSuggestionIndex}` : undefined}
              aria-autocomplete="list"
              className={inputClasses}
              placeholder={t("form.destinationPlaceholder")}
              value={end}
              onFocus={() => setEndFocused(true)}
              onBlur={() => setTimeout(() => setEndFocused(false), 150)}
              onChange={(event) => {
                setEnd(event.target.value);
                setEndPoint(undefined);
              }}
              onKeyDown={(event) => {
                if (!endSuggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveEndSuggestionIndex((previous) => (previous + 1) % endSuggestions.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveEndSuggestionIndex((previous) => (previous <= 0 ? endSuggestions.length - 1 : previous - 1));
                  return;
                }
                if (event.key === "Enter" && activeEndSuggestionIndex >= 0) {
                  event.preventDefault();
                  const suggestion = endSuggestions[activeEndSuggestionIndex];
                  if (suggestion) applyEndSuggestion(suggestion);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEndSuggestions([]);
                  setActiveEndSuggestionIndex(-1);
                }
              }}
            />
          </div>
          {endSuggestions.length ? (
            <div id="end-listbox" role="listbox" className="absolute left-0 right-0 top-[100%] z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-[var(--border)] bg-surface shadow-lg">
              {endSuggestions.map((suggestion, index) => (
                <button
                  id={`end-option-${index}`}
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeEndSuggestionIndex}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted ${
                    index === activeEndSuggestionIndex ? "bg-surface-muted text-[var(--accent)]" : ""
                  }`}
                  onMouseEnter={() => setActiveEndSuggestionIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyEndSuggestion(suggestion);
                  }}
                >
                  {suggestion.label}
                  {getLocalizedNameHint(end, suggestion.label) ? (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({getLocalizedNameHint(end, suggestion.label)})</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {/* Recent searches: shown when input focused, empty, and no autocomplete results */}
          {endFocused && !endSuggestions.length && !endPoint && end.trim().length < 2 && recentSearches.length > 0 ? (
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
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                >
                  {t("recentSearches.clear")}
                </button>
              </div>
              {recentSearches.map((item) => (
                <button
                  key={`recent-end-${item.label}-${item.lat}-${item.lon}`}
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-surface-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyEndSuggestion({ label: item.label, lat: item.lat, lon: item.lon });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {endPoint ? <p className="text-xs font-medium text-[var(--accent-green)]">{t("form.selectedAddressLocked")}</p> : null}
          {endNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-lg border border-[var(--accent)]/30 bg-[#FDF6EC] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              {t("form.approxWarning")}
              <button type="button" className="ml-2 font-medium underline" onClick={() => { setEndPoint(undefined); setEndSuggestions([]); }}>
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </div>

        {/* ─── Vehicle Type ─── */}
        <fieldset className="grid gap-2">
          <legend className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Car className="h-4 w-4 text-[var(--accent)]" />
            {t("form.vehicleType")}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {vehicleCards.map(({ value, emoji, labelKey, meta }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVehicleType(value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 text-sm font-medium transition-all ${
                  vehicleType === value
                    ? "border-[var(--accent)] bg-[#FDF6EC] text-[var(--accent)] shadow-sm"
                    : "border-[var(--border)] bg-surface text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-surface-muted hover:shadow-sm"
                }`}
              >
                <span className="text-2xl leading-none" role="img">{emoji}</span>
                <span className="font-semibold">{t(labelKey)}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{meta}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Powertrain ─── */}
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-[var(--text-primary)]">{t("form.powertrain")}</span>
          <select
            className={selectClasses}
            value={powertrainType}
            onChange={(event) => setPowertrainType(event.target.value as PowertrainType)}
          >
            <option value="PETROL">{t("form.powertrain.petrol")}</option>
            <option value="DIESEL">{t("form.powertrain.diesel")}</option>
            <option value="ELECTRIC">{t("form.powertrain.electric")}</option>
            <option value="HYBRID">{t("form.powertrain.hybrid")}</option>
          </select>
        </label>

        {/* ─── Avoid Tolls ─── */}
        <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={avoidTolls}
            onChange={(event) => setAvoidTolls(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] accent-[var(--accent)] focus:ring-[var(--accent)]"
          />
          {t("form.avoidTolls")}
        </label>

        {/* ─── Advanced Options toggle ─── */}
        <button
          type="button"
          onClick={() => setShowAdvanced((previous) => !previous)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-surface-muted px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border)]/30"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--text-muted)]" />
            {t("form.showAdvanced")}
          </span>
          <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {/* ─── Advanced options panel ─── */}
        {showAdvanced ? (
          <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-surface-muted/50 p-5">
            <div className={`grid gap-4 ${isMotorcycle ? "" : "sm:grid-cols-2"}`}>
              <label className="grid gap-1.5 text-sm">
                <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
                  {t("form.tripDate")}
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">{t("form.tripDateHelp")}</span>
                    </summary>
                    <span className="absolute z-20 mt-1 w-64 rounded-lg border border-[var(--border)] bg-surface p-2.5 text-xs font-normal text-[var(--text-secondary)] shadow-lg">
                      {t("form.tripDateHelp")}
                    </span>
                  </details>
                </span>
                <input
                  type="date"
                  className={advancedInputClasses}
                  value={dateISO}
                  onChange={(event) => setDateISO(event.target.value)}
                />
              </label>

              {!isMotorcycle ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-[var(--text-primary)]">{t("form.seats")}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className={advancedInputClasses}
                    value={seats}
                    onChange={(event) => setSeats(Number(event.target.value))}
                  />
                </label>
              ) : null}
            </div>

            {!isMotorcycle ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{t("form.grossWeight")}</span>
                    <input
                      type="number"
                      min={200}
                      max={60000}
                      className={advancedInputClasses}
                      placeholder={t("form.optional")}
                      value={grossWeightKgInput}
                      onChange={(event) => setGrossWeightKgInput(event.target.value)}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{t("form.axles")}</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      className={advancedInputClasses}
                      value={axles}
                      onChange={(event) => setAxles(Number(event.target.value))}
                    />
                  </label>

                  {powertrainType === "ELECTRIC" ? (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-[var(--text-primary)]">{t("form.emissionClass")}</span>
                      <input
                        className="rounded-lg border border-[var(--border)] bg-surface-muted px-3 py-2.5 text-sm text-[var(--text-muted)]"
                        value={t("form.emissionClass.auto")}
                        readOnly
                      />
                    </label>
                  ) : (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-[var(--text-primary)]">{t("form.emissionClass")}</span>
                      <select
                        className={advancedInputClasses}
                        value={emissionClass}
                        onChange={(event) => setEmissionClass(event.target.value as EmissionClass)}
                      >
                        <option value="UNKNOWN">{t("form.emission.unknown")}</option>
                        <option value="EURO_6">{t("form.emission.euro6")}</option>
                        <option value="EURO_5_OR_LOWER">{t("form.emission.euro5")}</option>
                      </select>
                    </label>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {t("form.profileCheck")}
                </p>
              </>
            ) : null}

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-[var(--text-primary)]">{t("form.channelCrossing")}</span>
              <select
                className={advancedInputClasses}
                value={channelCrossingPreference}
                onChange={(event) => setChannelCrossingPreference(event.target.value as "auto" | "ferry" | "tunnel")}
              >
                <option value="auto">{t("form.channel.auto")}</option>
                <option value="ferry">{t("form.channel.ferry")}</option>
                <option value="tunnel">{t("form.channel.tunnel")}</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <div id="form-error" role="alert" className="mx-5 mb-4 rounded-lg border border-[var(--accent-red)]/20 bg-[#FDF2F0] px-4 py-2.5 text-sm font-medium text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      {/* ─── Calculate Route button ─── */}
      <div className="px-5 pb-5">
        <button
          type="submit"
          disabled={loading || isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading || isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {t("form.submit")}
        </button>
      </div>
    </form>
  );
});
