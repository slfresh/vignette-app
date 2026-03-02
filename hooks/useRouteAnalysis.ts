"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  CountryCode,
  EmissionClass,
  PowertrainType,
  RouteAnalysisResult,
  VehicleClass,
} from "@/types/vignette";

interface RoutePayload {
  start: string;
  end: string;
  startPoint?: { lat: number; lon: number };
  endPoint?: { lat: number; lon: number };
  dateISO?: string;
  seats?: number;
  vehicleClass?: VehicleClass;
  powertrainType?: PowertrainType;
  grossWeightKg?: number;
  axles?: number;
  emissionClass?: EmissionClass;
  avoidTolls?: boolean;
  channelCrossingPreference?: "auto" | "ferry" | "tunnel";
}

interface RouteAnalysisState {
  result: RouteAnalysisResult | null;
  loading: boolean;
  error: string | null;
  errorCode: string | undefined;
  hoveredCountryCode: CountryCode | null;
  lockedCountryCode: CountryCode | null;
  expandedCountryCodes: Set<CountryCode>;
  activeCountryCode: CountryCode | null;
  highlightedSegments: RouteAnalysisResult["countries"][0]["routeSegments"];
  estimatedSavingsEuro: number;
  lastPayload: RoutePayload | null;
}

interface RouteAnalysisActions {
  submitRoute: (payload: RoutePayload) => Promise<void>;
  setHoveredCountryCode: (code: CountryCode | null) => void;
  setLockedCountryCode: React.Dispatch<React.SetStateAction<CountryCode | null>>;
  setExpandedCountryCodes: React.Dispatch<React.SetStateAction<Set<CountryCode>>>;
  handleCountrySummaryClick: (code: CountryCode) => void;
  handleExpandToggle: (code: CountryCode) => void;
  fetchAlternativeRoute: (avoidTolls: boolean) => Promise<RouteAnalysisResult | null>;
  countryCardRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
}

export type RouteAnalysis = RouteAnalysisState & RouteAnalysisActions;

/**
 * Encapsulates all route analysis state: result, loading, errors,
 * country highlighting, and alternative-route fetching.
 */
export function useRouteAnalysis(
  router: { replace: (url: string, opts?: { scroll?: boolean }) => void },
  searchParams: URLSearchParams,
): RouteAnalysis {
  const [result, setResult] = useState<RouteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [hoveredCountryCode, setHoveredCountryCode] = useState<CountryCode | null>(null);
  const [lockedCountryCode, setLockedCountryCode] = useState<CountryCode | null>(null);
  const [expandedCountryCodes, setExpandedCountryCodes] = useState<Set<CountryCode>>(new Set());
  const lastPayloadRef = useRef<RoutePayload | null>(null);
  const countryCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const submitAbortRef = useRef<AbortController | null>(null);

  const submitRoute = useCallback(async (payload: RoutePayload) => {
    setError(null);
    setErrorCode(undefined);
    setResult(null);
    setLoading(true);
    setHoveredCountryCode(null);
    setLockedCountryCode(null);
    setExpandedCountryCodes(new Set());
    lastPayloadRef.current = payload;

    try {
      submitAbortRef.current?.abort();
      const abortController = new AbortController();
      submitAbortRef.current = abortController;

      const response = await fetch("/api/route-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string; code?: string };
        setErrorCode(body.code);
        throw new Error(body.error ?? "Could not calculate route.");
      }

      const data = (await response.json()) as RouteAnalysisResult;
      setResult(data);

      const fromParam = encodeURIComponent(payload.start.trim());
      const toParam = encodeURIComponent(payload.end.trim());
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("from", fromParam);
      newParams.set("to", toParam);
      router.replace(`/?${newParams.toString()}`, { scroll: false });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unexpected error occurred.";
      setError(message);
      throw submitError;
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

  const activeCountryCode = lockedCountryCode ?? hoveredCountryCode;

  const highlightedSegments = useMemo(() => {
    if (!result || !activeCountryCode) return [];
    const selected = result.countries.find((c) => c.countryCode === activeCountryCode);
    return selected?.routeSegments ?? [];
  }, [result, activeCountryCode]);

  const estimatedSavingsEuro = useMemo(() => {
    if (!result) return 0;
    return result.countries.filter((c) => c.requiresVignette).length * 8.5;
  }, [result]);

  const handleCountrySummaryClick = useCallback((code: CountryCode) => {
    setLockedCountryCode((prev) => (prev === code ? null : code));
    setExpandedCountryCodes((prev) => new Set(prev).add(code));
    const el = countryCardRefs.current[code];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleExpandToggle = useCallback((code: CountryCode) => {
    setExpandedCountryCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const fetchAlternativeRoute = useCallback(async (avoidTolls: boolean): Promise<RouteAnalysisResult | null> => {
    if (!lastPayloadRef.current) return null;
    const payload = { ...lastPayloadRef.current, avoidTolls };
    try {
      const resp = await fetch("/api/route-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) return null;
      return (await resp.json()) as RouteAnalysisResult;
    } catch {
      return null;
    }
  }, []);

  return {
    result,
    loading,
    error,
    errorCode,
    hoveredCountryCode,
    lockedCountryCode,
    expandedCountryCodes,
    activeCountryCode,
    highlightedSegments,
    estimatedSavingsEuro,
    lastPayload: lastPayloadRef.current,
    submitRoute,
    setHoveredCountryCode,
    setLockedCountryCode,
    setExpandedCountryCodes,
    handleCountrySummaryClick,
    handleExpandToggle,
    fetchAlternativeRoute,
    countryCardRefs,
  };
}
