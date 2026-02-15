"use client";

import { Bike, Car, ChevronDown, Info, Loader2, Search, Send, Settings, Truck } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { EmissionClass, PowertrainType, RoutePoint, VehicleClass } from "@/types/vignette";

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
  }

  function applyEndSuggestion(suggestion: GeocodeSuggestion) {
    setEnd(suggestion.label);
    setEndPoint({ lat: suggestion.lat, lon: suggestion.lon });
    setEndSuggestions([]);
    setActiveEndSuggestionIndex(-1);
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

  useImperativeHandle(ref, () => ({
    setStartFromMap: (label: string, point: RoutePoint) => {
      setStart(label);
      setStartPoint(point);
      setStartSuggestions([]);
    },
    setEndFromMap: (label: string, point: RoutePoint) => {
      setEnd(label);
      setEndPoint(point);
      setEndSuggestions([]);
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

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Send className="h-5 w-5" />
          {t("form.title")}
        </h2>
        <p className="mt-1 text-sm text-blue-100">{t("form.subtitle")}</p>
      </div>

      <div className="grid gap-5 p-6">
        {/* ─── Origin ─── */}
        <div className="relative grid gap-1.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-zinc-800">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white" aria-hidden>A</span>
            {t("form.start")}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              role="combobox"
              aria-expanded={startSuggestions.length > 0}
              aria-controls="start-listbox"
              aria-activedescendant={activeStartSuggestionIndex >= 0 ? `start-option-${activeStartSuggestionIndex}` : undefined}
              aria-autocomplete="list"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder={t("form.startPlaceholder")}
              value={start}
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
            <div id="start-listbox" role="listbox" className="absolute left-0 right-0 top-[100%] z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {startSuggestions.map((suggestion, index) => (
                <button
                  id={`start-option-${index}`}
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeStartSuggestionIndex}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-zinc-800 transition-colors hover:bg-blue-50 ${
                    index === activeStartSuggestionIndex ? "bg-blue-50 text-blue-700" : ""
                  }`}
                  onMouseEnter={() => setActiveStartSuggestionIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyStartSuggestion(suggestion);
                  }}
                >
                  {suggestion.label}
                  {getLocalizedNameHint(start, suggestion.label) ? (
                    <span className="ml-2 text-xs text-zinc-500">({getLocalizedNameHint(start, suggestion.label)})</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {startPoint ? <p className="text-xs font-medium text-emerald-600">{t("form.selectedAddressLocked")}</p> : null}
          {startNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              {t("form.approxWarning")}
              <button type="button" className="ml-2 font-medium underline" onClick={() => { setStartPoint(undefined); setStartSuggestions([]); }}>
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </div>

        {/* ─── Destination ─── */}
        <div className="relative grid gap-1.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-zinc-800">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white" aria-hidden>B</span>
            {t("form.destination")}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              role="combobox"
              aria-expanded={endSuggestions.length > 0}
              aria-controls="end-listbox"
              aria-activedescendant={activeEndSuggestionIndex >= 0 ? `end-option-${activeEndSuggestionIndex}` : undefined}
              aria-autocomplete="list"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder={t("form.destinationPlaceholder")}
              value={end}
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
            <div id="end-listbox" role="listbox" className="absolute left-0 right-0 top-[100%] z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {endSuggestions.map((suggestion, index) => (
                <button
                  id={`end-option-${index}`}
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeEndSuggestionIndex}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-zinc-800 transition-colors hover:bg-blue-50 ${
                    index === activeEndSuggestionIndex ? "bg-blue-50 text-blue-700" : ""
                  }`}
                  onMouseEnter={() => setActiveEndSuggestionIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyEndSuggestion(suggestion);
                  }}
                >
                  {suggestion.label}
                  {getLocalizedNameHint(end, suggestion.label) ? (
                    <span className="ml-2 text-xs text-zinc-500">({getLocalizedNameHint(end, suggestion.label)})</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {endPoint ? <p className="text-xs font-medium text-emerald-600">{t("form.selectedAddressLocked")}</p> : null}
          {endNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              {t("form.approxWarning")}
              <button type="button" className="ml-2 font-medium underline" onClick={() => { setEndPoint(undefined); setEndSuggestions([]); }}>
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </div>

        {/* ─── Vehicle Type – 2-column card grid ─── */}
        <fieldset className="grid gap-2">
          <legend className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <Car className="h-4 w-4 text-blue-600" />
            {t("form.vehicleType")}
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {vehicleCards.map(({ value, emoji, labelKey, meta }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVehicleType(value)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 text-sm font-medium transition-all ${
                  vehicleType === value
                    ? "border-blue-500 bg-blue-50/80 text-blue-700 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm"
                }`}
              >
                <span className="text-2xl leading-none" role="img">{emoji}</span>
                <span className="font-semibold">{t(labelKey)}</span>
                <span className="text-[11px] text-zinc-500">{meta}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ─── Powertrain ─── */}
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-zinc-800">{t("form.powertrain")}</span>
          <select
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={powertrainType}
            onChange={(event) => setPowertrainType(event.target.value as PowertrainType)}
          >
            <option value="PETROL">{t("form.powertrain.petrol")}</option>
            <option value="DIESEL">{t("form.powertrain.diesel")}</option>
            <option value="ELECTRIC">{t("form.powertrain.electric")}</option>
            <option value="HYBRID">{t("form.powertrain.hybrid")}</option>
          </select>
        </label>

        {/* ─── Quick checkbox: Avoid Tolls ─── */}
        <label className="inline-flex items-center gap-2.5 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={avoidTolls}
            onChange={(event) => setAvoidTolls(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          {t("form.avoidTolls")}
        </label>

        {/* ─── Advanced Options toggle ─── */}
        <button
          type="button"
          onClick={() => setShowAdvanced((previous) => !previous)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-500" />
            {t("form.showAdvanced")}
          </span>
          <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {/* ─── Advanced options panel ─── */}
        {showAdvanced ? (
          <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
            <div className={`grid gap-4 ${isMotorcycle ? "" : "sm:grid-cols-2"}`}>
              <label className="grid gap-1.5 text-sm">
                <span className="flex items-center gap-1 font-medium text-zinc-800">
                  {t("form.tripDate")}
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center text-zinc-500 hover:text-zinc-700">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">{t("form.tripDateHelp")}</span>
                    </summary>
                    <span className="absolute z-20 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs font-normal text-zinc-700 shadow-lg">
                      {t("form.tripDateHelp")}
                    </span>
                  </details>
                </span>
                <input
                  type="date"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={dateISO}
                  onChange={(event) => setDateISO(event.target.value)}
                />
              </label>

              {!isMotorcycle ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-zinc-800">{t("form.seats")}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    <span className="font-medium text-zinc-800">{t("form.grossWeight")}</span>
                    <input
                      type="number"
                      min={200}
                      max={60000}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder={t("form.optional")}
                      value={grossWeightKgInput}
                      onChange={(event) => setGrossWeightKgInput(event.target.value)}
                    />
                  </label>

                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-zinc-800">{t("form.axles")}</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={axles}
                      onChange={(event) => setAxles(Number(event.target.value))}
                    />
                  </label>

                  {powertrainType === "ELECTRIC" ? (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-zinc-800">{t("form.emissionClass")}</span>
                      <input
                        className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600"
                        value={t("form.emissionClass.auto")}
                        readOnly
                      />
                    </label>
                  ) : (
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium text-zinc-800">{t("form.emissionClass")}</span>
                      <select
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <p className="text-xs text-zinc-500">
                  {t("form.profileCheck")}
                </p>
              </>
            ) : null}

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-zinc-800">{t("form.channelCrossing")}</span>
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
        <div id="form-error" role="alert" className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {/* ─── Full-width Calculate Route button ─── */}
      <div className="px-6 pb-6">
        <button
          type="submit"
          disabled={loading || isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading || isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {t("form.submit")}
        </button>
      </div>
    </form>
  );
});
