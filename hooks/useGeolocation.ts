"use client";

import { useEffect, useState } from "react";

/**
 * Geolocation result returned by the hook.
 *
 * - `position` is `null` until the browser resolves or if the user denies access.
 * - `loading` is `true` while the browser is asking for permission / resolving GPS.
 * - `error` contains a human-readable message when geolocation fails.
 */
export interface GeolocationState {
  position: { lat: number; lon: number } | null;
  loading: boolean;
  error: string | null;
}

/** Maximum time (ms) to wait for the browser to return a position. */
const POSITION_TIMEOUT_MS = 10_000;

/** Check whether the Geolocation API is available (client-side only). */
function isGeolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

/**
 * Calls `navigator.geolocation.getCurrentPosition` once on mount.
 * Returns the user's GPS coordinates, a loading flag, and an error string.
 *
 * Gracefully degrades when:
 * - The browser doesn't support the Geolocation API
 * - The user denies location permission
 * - The request times out
 */
export function useGeolocation(): GeolocationState {
  // Compute availability once at module level to avoid ref-during-render.
  // This is safe because the hook only runs on the client where navigator exists.
  const [geoSupported] = useState(() => isGeolocationAvailable());
  const [state, setState] = useState<GeolocationState>({
    position: null,
    loading: geoSupported,
    error: geoSupported ? null : "Geolocation is not supported by this browser.",
  });

  useEffect(() => {
    // If geolocation is not available, the initial state already reflects that
    if (!geoSupported) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setState({
          position: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          loading: false,
          error: null,
        });
      },
      (err) => {
        if (cancelled) return;
        let message = "Could not determine your location.";
        if (err.code === err.PERMISSION_DENIED) {
          message = "Location access was denied.";
        } else if (err.code === err.TIMEOUT) {
          message = "Location request timed out.";
        }
        setState({ position: null, loading: false, error: message });
      },
      {
        enableHighAccuracy: false, // Low accuracy is faster and sufficient for city-level centering
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: 60_000, // Accept a cached position up to 60 seconds old
      },
    );

    return () => {
      cancelled = true;
    };
  }, [geoSupported]);

  return state;
}
