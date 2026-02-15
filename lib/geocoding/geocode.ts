/**
 * Shared geocoding utilities used by both route-analysis and geocode API routes.
 *
 * Provides forward geocoding with a three-tier fallback chain:
 *   1. ORS (OpenRouteService) – primary, requires API key
 *   2. Photon (Komoot) – free, no key needed
 *   3. Nominatim (OpenStreetMap) – free, rate-limited
 *
 * Also provides coordinate parsing and Europe bounds checking.
 */

import { geocodeAddressCache } from "@/lib/cache/geocodeCache";
import type { RoutePoint } from "@/types/vignette";

/* ─── Constants ─── */
const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const PHOTON_GEOCODE_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_TIMEOUT_MS = 8_000;
const DEFAULT_CONTACT_EMAIL = "support@example.com";

/* ─── Helpers ─── */

/** Create an AbortSignal that fires after the given number of milliseconds. */
export function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

/** Parse a "lat,lon" string into a RoutePoint, or null if not valid coordinates. */
export function parseCoordinates(rawValue: string): RoutePoint | null {
  const parts = rawValue.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

/** Validate and normalize a RoutePoint, returning null if invalid. */
export function normalizePoint(point: RoutePoint | undefined): RoutePoint | null {
  if (!point) return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) return null;
  return { lat: point.lat, lon: point.lon };
}

function getNominatimUserAgent(): string {
  const contactEmail = process.env.APP_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  return `EuropeanVignettePortal/1.0 (contact: ${contactEmail})`;
}

/* ─── Provider functions ─── */

async function geocodeWithOrs(query: string, apiKey: string): Promise<RoutePoint> {
  const url = `${ORS_GEOCODE_URL}?text=${encodeURIComponent(query)}&size=1`;
  const { signal, clear } = timeoutSignal(GEOCODE_TIMEOUT_MS);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: apiKey },
    signal,
  }).finally(clear);

  if (!response.ok) throw new Error(`ORS geocoding failed (${response.status}).`);

  const data = (await response.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length !== 2) throw new Error("ORS geocoding returned no result.");

  return { lon: Number(coordinates[0]), lat: Number(coordinates[1]) };
}

async function geocodeWithPhoton(query: string): Promise<RoutePoint> {
  const url = `${PHOTON_GEOCODE_URL}?q=${encodeURIComponent(query)}&limit=1`;
  const { signal, clear } = timeoutSignal(GEOCODE_TIMEOUT_MS);
  const response = await fetch(url, { cache: "no-store", signal }).finally(clear);

  if (!response.ok) throw new Error(`Photon geocoding failed (${response.status}).`);

  const data = (await response.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length !== 2) throw new Error("Photon geocoding returned no result.");

  return { lon: Number(coordinates[0]), lat: Number(coordinates[1]) };
}

async function geocodeWithNominatim(query: string): Promise<RoutePoint> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const { signal, clear } = timeoutSignal(GEOCODE_TIMEOUT_MS);
  const response = await fetch(url, {
    headers: { "User-Agent": getNominatimUserAgent() },
    cache: "no-store",
    signal,
  }).finally(clear);

  if (!response.ok) throw new Error(`Geocoding failed (${response.status}).`);

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const match = data[0];
  if (!match) throw new Error("Could not resolve one of the locations.");

  return { lat: Number(match.lat), lon: Number(match.lon) };
}

/* ─── Main geocoding function ─── */

/**
 * Geocode an address string to coordinates, using a three-tier fallback:
 * ORS → Photon → Nominatim. Results are cached to avoid redundant calls.
 *
 * @throws Error if none of the providers can resolve the address in Europe
 */
export async function geocodeAddress(query: string): Promise<RoutePoint> {
  const cacheKey = query.trim().toLowerCase();
  const cached = geocodeAddressCache.get(cacheKey);
  if (cached) return cached;

  const orsApiKey = process.env.ORS_API_KEY?.trim();

  // Tier 1: ORS (if API key available)
  if (orsApiKey) {
    try {
      const point = await geocodeWithOrs(query, orsApiKey);
      geocodeAddressCache.set(cacheKey, point);
      return point;
    } catch {
      // Fall through to next provider
    }
  }

  // Tier 2: Photon
  try {
    const point = await geocodeWithPhoton(query);
    geocodeAddressCache.set(cacheKey, point);
    return point;
  } catch {
    // Fall through to next provider
  }

  // Tier 3: Nominatim
  try {
    const point = await geocodeWithNominatim(query);
    geocodeAddressCache.set(cacheKey, point);
    return point;
  } catch {
    throw new Error(
      `Could not resolve "${query}". Check spelling or try a more specific name (e.g., "Lyon, France").`,
    );
  }

  throw new Error(
    `Could not locate "${query}". Try a more specific name (e.g., "Lyon, France").`,
  );
}

/**
 * Resolve a location input: if it looks like "lat,lon" coordinates,
 * parse them directly; otherwise, geocode the address string.
 */
export async function resolveLocation(input: string): Promise<RoutePoint> {
  const coordinatePoint = parseCoordinates(input);
  if (coordinatePoint) return coordinatePoint;
  return geocodeAddress(input);
}
