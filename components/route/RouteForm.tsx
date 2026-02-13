"use client";

import { Info, Loader2, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { EmissionClass, PowertrainType, RoutePoint, VehicleClass } from "@/types/vignette";

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
}

export function RouteForm({ onSubmit }: RouteFormProps) {
  const { t } = useI18n();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
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
  const [powertrainType, setPowertrainType] = useState<PowertrainType>("PETROL");
  const [vehicleType, setVehicleType] = useState<"car" | "motorcycle" | "camper">("car");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [channelCrossingPreference, setChannelCrossingPreference] = useState<"auto" | "ferry" | "tunnel">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { suggestions?: GeocodeSuggestion[] };
        setStartSuggestions(body.suggestions ?? []);
      } catch {
        setStartSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
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

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { suggestions?: GeocodeSuggestion[] };
        setEndSuggestions(body.suggestions ?? []);
      } catch {
        setEndSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [end, endPoint]);

  useEffect(() => {
    setActiveEndSuggestionIndex(-1);
  }, [endSuggestions]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("form.error.routeRequestFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">{t("form.title")}</h2>
      <p className="mb-4 text-sm text-zinc-600">{t("form.subtitle")}</p>

      <div className="grid gap-3">
        <label className="relative grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">{t("form.start")}</span>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            placeholder={t("form.startPlaceholder")}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setStartPoint(undefined);
            }}
            onKeyDown={(event) => {
              if (!startSuggestions.length) {
                return;
              }

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
                if (suggestion) {
                  applyStartSuggestion(suggestion);
                }
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setStartSuggestions([]);
                setActiveStartSuggestionIndex(-1);
              }
            }}
          />
          {startSuggestions.length ? (
            <div className="absolute top-[100%] z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {startSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 ${
                    index === activeStartSuggestionIndex ? "bg-zinc-100" : ""
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
          {startPoint ? <p className="text-xs text-emerald-700">{t("form.selectedAddressLocked")}</p> : null}
          {startNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              {t("form.approxWarning")}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  setStartPoint(undefined);
                  setStartSuggestions([]);
                }}
              >
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </label>

        <label className="relative grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">{t("form.destination")}</span>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            placeholder={t("form.destinationPlaceholder")}
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setEndPoint(undefined);
            }}
            onKeyDown={(event) => {
              if (!endSuggestions.length) {
                return;
              }

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
                if (suggestion) {
                  applyEndSuggestion(suggestion);
                }
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setEndSuggestions([]);
                setActiveEndSuggestionIndex(-1);
              }
            }}
          />
          {endSuggestions.length ? (
            <div className="absolute top-[100%] z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {endSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 ${
                    index === activeEndSuggestionIndex ? "bg-zinc-100" : ""
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
          {endPoint ? <p className="text-xs text-emerald-700">{t("form.selectedAddressLocked")}</p> : null}
          {endNeedsApproximateMatchWarning ? (
            <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              {t("form.approxWarning")}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  setEndPoint(undefined);
                  setEndSuggestions([]);
                }}
              >
                {t("form.useTypedAddress")}
              </button>
            </div>
          ) : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">{t("form.vehicleType")}</span>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={vehicleType}
            onChange={(event) => setVehicleType(event.target.value as "car" | "motorcycle" | "camper")}
          >
            <option value="car">{t("form.vehicle.car")}</option>
            <option value="motorcycle">{t("form.vehicle.motorcycle")}</option>
            <option value="camper">{t("form.vehicle.camper")}</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">{t("form.powertrain")}</span>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={powertrainType}
            onChange={(event) => setPowertrainType(event.target.value as PowertrainType)}
          >
            <option value="PETROL">{t("form.powertrain.petrol")}</option>
            <option value="DIESEL">{t("form.powertrain.diesel")}</option>
            <option value="ELECTRIC">{t("form.powertrain.electric")}</option>
            <option value="HYBRID">{t("form.powertrain.hybrid")}</option>
          </select>
        </label>

        <div className={`grid gap-3 ${isMotorcycle ? "" : "sm:grid-cols-2"}`}>
          <label className="grid gap-1 text-sm">
            <span className="flex items-center gap-1 font-medium text-zinc-800">
              {t("form.tripDate")}
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center text-zinc-500 hover:text-zinc-700">
                  <Info className="h-4 w-4" />
                  <span className="sr-only">{t("form.tripDateHelp")}</span>
                </summary>
                <span className="absolute z-20 mt-1 w-64 rounded-md border border-zinc-200 bg-white p-2 text-xs font-normal text-zinc-700 shadow-lg">
                  {t("form.tripDateHelp")}
                </span>
              </details>
            </span>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2"
              value={dateISO}
              onChange={(event) => setDateISO(event.target.value)}
            />
          </label>

          {!isMotorcycle ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-zinc-800">{t("form.seats")}</span>
              <input
                type="number"
                min={1}
                max={20}
                className="rounded-md border border-zinc-300 px-3 py-2"
                value={seats}
                onChange={(event) => setSeats(Number(event.target.value))}
              />
            </label>
          ) : null}
        </div>

        {!isMotorcycle ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-zinc-800">{t("form.grossWeight")}</span>
                <input
                  type="number"
                  min={200}
                  max={60000}
                  className="rounded-md border border-zinc-300 px-3 py-2"
                  placeholder={t("form.optional")}
                  value={grossWeightKgInput}
                  onChange={(event) => setGrossWeightKgInput(event.target.value)}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-zinc-800">{t("form.axles")}</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  className="rounded-md border border-zinc-300 px-3 py-2"
                  value={axles}
                  onChange={(event) => setAxles(Number(event.target.value))}
                />
              </label>

              {powertrainType === "ELECTRIC" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-zinc-800">{t("form.emissionClass")}</span>
                  <input
                    className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-700"
                    value={t("form.emissionClass.auto")}
                    readOnly
                  />
                </label>
              ) : (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-zinc-800">{t("form.emissionClass")}</span>
                  <select
                    className="rounded-md border border-zinc-300 px-3 py-2"
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
            <p className="text-xs text-zinc-600">
              {t("form.profileCheck")}
            </p>
          </>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">{t("form.channelCrossing")}</span>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2"
              value={channelCrossingPreference}
              onChange={(event) => setChannelCrossingPreference(event.target.value as "auto" | "ferry" | "tunnel")}
            >
              <option value="auto">{t("form.channel.auto")}</option>
              <option value="ferry">{t("form.channel.ferry")}</option>
              <option value="tunnel">{t("form.channel.tunnel")}</option>
            </select>
          </label>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-800 sm:mt-8">
            <input
              type="checkbox"
              checked={avoidTolls}
              onChange={(event) => setAvoidTolls(event.target.checked)}
            />
            {t("form.avoidTolls")}
          </label>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
        {t("form.submit")}
      </button>
    </form>
  );
}
