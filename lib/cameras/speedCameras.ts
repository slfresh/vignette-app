/**
 * Speed camera data from the Lufop API (https://api.lufop.net).
 *
 * Provides European speed camera locations (50,000+ across 20+ countries).
 * Data is licensed under CC BY-SA 4.0 — attribution to lufop.net required.
 *
 * The API requires a free API key set via LUFOP_API_KEY env var.
 * When the key is missing, the feature is silently disabled.
 */

import { logger } from "@/lib/logging/logger";

const LUFOP_API_URL = "https://api.lufop.net/api";
const LUFOP_TIMEOUT_MS = 10_000;

/** Supported Lufop country codes. */
export const LUFOP_COUNTRIES = [
  "fr", "it", "ch", "es", "gb", "de", "be", "ie", "ad", "au",
  "bg", "ca", "lv", "lu", "no", "nz", "nl", "pl", "pt", "cz", "se", "ma",
] as const;

export type LufopCountry = (typeof LUFOP_COUNTRIES)[number];

/** Flash direction: D = both, B = back, F = front */
export type FlashDirection = "D" | "B" | "F";

/** A single speed camera from the Lufop API. */
export interface SpeedCamera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  city: string;
  road: string;
  flashDirection: FlashDirection;
  azimuth: number;
  speedLimit: number | null;
  updatedAt: string;
}

/** Raw JSON response from Lufop. */
interface LufopRawEntry {
  ID: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  commune: string;
  voie: string;
  flash: string;
  azimut: string;
  update: string;
  vitesse?: string;
}

function parseLufopEntry(raw: LufopRawEntry): SpeedCamera {
  return {
    id: raw.ID,
    name: raw.name,
    lat: raw.lat,
    lon: raw.lng,
    type: raw.type,
    city: raw.commune ?? "",
    road: raw.voie ?? "",
    flashDirection: (raw.flash as FlashDirection) || "D",
    azimuth: Number(raw.azimut) || 0,
    speedLimit: raw.vitesse ? Number(raw.vitesse) : null,
    updatedAt: raw.update ?? "",
  };
}

/**
 * Fetch speed cameras near a GPS point from the Lufop API.
 *
 * @param lat - Center latitude
 * @param lon - Center longitude
 * @param radiusKm - Radius in km (approximate; Lufop uses bounding box internally)
 * @param country - Lufop country code (default: all countries along route)
 * @param maxResults - Maximum number of results (default 200, max 10000)
 */
export async function fetchSpeedCameras(options: {
  lat: number;
  lon: number;
  radiusKm?: number;
  country?: string;
  maxResults?: number;
}): Promise<SpeedCamera[]> {
  const apiKey = process.env.LUFOP_API_KEY?.trim();
  if (!apiKey) {
    logger.debug("LUFOP_API_KEY not set, speed cameras disabled");
    return [];
  }

  const { lat, lon, radiusKm = 50, country, maxResults = 500 } = options;

  // Lufop 'm' parameter is ~1/10 of a real km
  const margin = Math.round(radiusKm * 10);

  const params = new URLSearchParams({
    key: apiKey,
    format: "json",
    q: `${lat},${lon}`,
    m: String(margin),
    nbr: String(Math.min(maxResults, 10_000)),
  });
  if (country) {
    params.set("pays", country.toLowerCase());
  }

  const url = `${LUFOP_API_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LUFOP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      logger.warn("Lufop API error", { status: response.status });
      return [];
    }

    const data = (await response.json()) as LufopRawEntry[];
    if (!Array.isArray(data)) return [];

    return data.map(parseLufopEntry);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Lufop API request timed out");
    } else {
      logger.warn("Lufop API fetch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }
}

/**
 * Fetch speed cameras along a route by sampling points along the route
 * and querying the Lufop API for cameras near each sample point.
 *
 * @param routeCoordinates - Array of [lon, lat] coordinate pairs from ORS
 * @param radiusKm - Search radius around each sample point
 */
export async function fetchSpeedCamerasAlongRoute(
  routeCoordinates: [number, number][],
  radiusKm: number = 30,
): Promise<SpeedCamera[]> {
  if (routeCoordinates.length === 0) return [];

  // Sample points along the route (every ~100km to avoid too many API calls)
  const samplePoints = sampleRoutePoints(routeCoordinates, 100);

  // Fetch cameras for each sample point in parallel
  const results = await Promise.all(
    samplePoints.map((point) =>
      fetchSpeedCameras({ lat: point.lat, lon: point.lon, radiusKm }),
    ),
  );

  // Deduplicate by camera ID
  const seen = new Set<string>();
  const cameras: SpeedCamera[] = [];
  for (const batch of results) {
    for (const cam of batch) {
      if (!seen.has(cam.id)) {
        seen.add(cam.id);
        cameras.push(cam);
      }
    }
  }

  return cameras;
}

/** Sample evenly-spaced points along a route polyline. */
function sampleRoutePoints(
  coords: [number, number][],
  intervalKm: number,
): Array<{ lat: number; lon: number }> {
  if (coords.length === 0) return [];

  const points: Array<{ lat: number; lon: number }> = [];
  // Always include start
  points.push({ lat: coords[0][1], lon: coords[0][0] });

  let accumulatedKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    accumulatedKm += haversineKm(lat1, lon1, lat2, lon2);

    if (accumulatedKm >= intervalKm) {
      points.push({ lat: lat2, lon: lon2 });
      accumulatedKm = 0;
    }
  }

  // Always include end
  const last = coords[coords.length - 1];
  const lastPoint = { lat: last[1], lon: last[0] };
  if (points.length === 0 || points[points.length - 1].lat !== lastPoint.lat) {
    points.push(lastPoint);
  }

  return points;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
