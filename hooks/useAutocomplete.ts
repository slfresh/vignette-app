"use client";

import { useEffect, useRef, useState } from "react";

export interface AutocompleteSuggestion {
  label: string;
  lat: number;
  lon: number;
}

interface UseAutocompleteOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

/**
 * Debounced geocode suggest fetch with abort + stale-response guards.
 */
export function useAutocomplete(
  query: string,
  lockedPoint: { lat: number; lon: number } | undefined,
  options: UseAutocompleteOptions = {},
) {
  const { debounceMs = 250, minQueryLength = 2 } = options;
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (lockedPoint) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    const timeoutId = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const body = (await response.json()) as { suggestions?: AutocompleteSuggestion[] };
        setSuggestions(body.suggestions ?? []);
      } catch {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [query, lockedPoint, debounceMs, minQueryLength]);

  return { suggestions, setSuggestions, isLoading };
}
