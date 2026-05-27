/**
 * Open-Meteo weather forecast integration.
 *
 * Fetches hourly weather data for sample points along a route.
 * Free API, no key required. European coverage is excellent.
 *
 * @see https://open-meteo.com/en/docs
 */

import { haversineKm } from "@/lib/utils/geo";
import { logger } from "@/lib/logging/logger";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_TIMEOUT_MS = 10_000;

/** Weather data for a single point along the route. */
export interface RouteWeatherPoint {
  lat: number;
  lon: number;
  /** Human-readable location label (e.g. "Point 2 of 5 (~340 km)") */
  label: string;
  temperature: number;
  windSpeed: number;
  windGusts: number;
  precipitationProbability: number;
  visibility: number;
  weatherCode: number;
  weatherDescription: string;
}

/** Aggregated weather forecast for the entire route. */
export interface RouteWeatherForecast {
  points: RouteWeatherPoint[];
  /** Overall worst-case warnings derived from the data */
  warnings: string[];
  fetchedAt: string;
}

/**
 * WMO weather interpretation codes → human descriptions.
 * @see https://open-meteo.com/en/docs#weathervariables
 */
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeatherCode(code: number): string {
  return WMO_CODES[code] ?? "Unknown";
}

/** Open-Meteo JSON response shape for a single-location request. */
interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    precipitation_probability?: number[];
    visibility?: number[];
    weather_code?: number[];
  };
}

/**
 * Find the hourly index closest to "now" (or a target hour for the trip date).
 * Defaults to the current hour.
 */
function findNearestHourIndex(times: string[], targetDate?: string): number {
  const target = targetDate ? new Date(targetDate) : new Date();
  const targetMs = target.getTime();
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Sample evenly-spaced points along a route polyline (ORS [lon, lat] format). */
function sampleRoutePoints(
  coords: [number, number][],
  maxPoints: number,
): Array<{ lat: number; lon: number; distanceKm: number }> {
  if (coords.length === 0) return [];

  let totalKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    totalKm += haversineKm(lat1, lon1, lat2, lon2);
  }

  const intervalKm = totalKm / (maxPoints - 1);
  const points: Array<{ lat: number; lon: number; distanceKm: number }> = [];

  points.push({ lat: coords[0][1], lon: coords[0][0], distanceKm: 0 });

  let accumulatedKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    accumulatedKm += haversineKm(lat1, lon1, lat2, lon2);

    if (accumulatedKm >= intervalKm && points.length < maxPoints - 1) {
      points.push({ lat: lat2, lon: lon2, distanceKm: Math.round(accumulatedKm + (points.length - 1) * intervalKm) });
      accumulatedKm = 0;
    }
  }

  const last = coords[coords.length - 1];
  if (points.length < maxPoints) {
    points.push({ lat: last[1], lon: last[0], distanceKm: Math.round(totalKm) });
  }

  return points;
}

/**
 * Fetch weather forecast for a single point from Open-Meteo.
 */
async function fetchPointWeather(
  lat: number,
  lon: number,
  targetDate?: string,
): Promise<Omit<RouteWeatherPoint, "label"> | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: "temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,visibility,weather_code",
    forecast_days: "2",
    timezone: "auto",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPEN_METEO_TIMEOUT_MS);

  try {
    const resp = await fetch(`${OPEN_METEO_URL}?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeoutId));

    if (!resp.ok) {
      logger.warn("Open-Meteo API error", { status: resp.status });
      return null;
    }

    const data = (await resp.json()) as OpenMeteoResponse;
    const hourly = data.hourly;
    if (!hourly?.time?.length) return null;

    const idx = findNearestHourIndex(hourly.time, targetDate);

    const weatherCode = hourly.weather_code?.[idx] ?? 0;

    return {
      lat,
      lon,
      temperature: hourly.temperature_2m?.[idx] ?? 0,
      windSpeed: hourly.wind_speed_10m?.[idx] ?? 0,
      windGusts: hourly.wind_gusts_10m?.[idx] ?? 0,
      precipitationProbability: hourly.precipitation_probability?.[idx] ?? 0,
      visibility: hourly.visibility?.[idx] ?? 10000,
      weatherCode,
      weatherDescription: describeWeatherCode(weatherCode),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Open-Meteo request timed out");
    } else {
      logger.warn("Open-Meteo fetch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

/**
 * Fetch weather forecast for sample points along a route.
 *
 * @param routeCoordinates - ORS-format [lon, lat] coordinate pairs
 * @param targetDate - Optional ISO date string for the trip date
 * @param maxPoints - Number of sample points (default 5)
 */
export async function fetchRouteWeather(
  routeCoordinates: [number, number][],
  targetDate?: string,
  maxPoints: number = 5,
): Promise<RouteWeatherForecast> {
  if (routeCoordinates.length === 0) {
    return { points: [], warnings: [], fetchedAt: new Date().toISOString() };
  }

  const samplePoints = sampleRoutePoints(routeCoordinates, maxPoints);

  const results = await Promise.all(
    samplePoints.map((pt) => fetchPointWeather(pt.lat, pt.lon, targetDate)),
  );

  const points: RouteWeatherPoint[] = [];
  for (let i = 0; i < samplePoints.length; i++) {
    const weatherData = results[i];
    if (!weatherData) continue;

    points.push({
      ...weatherData,
      label: `Point ${i + 1} of ${samplePoints.length} (~${samplePoints[i].distanceKm} km)`,
    });
  }

  const warnings = deriveWarnings(points);

  return {
    points,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

/** Derive actionable warnings from weather data across all route points. */
function deriveWarnings(points: RouteWeatherPoint[]): string[] {
  const warnings: string[] = [];

  const highGustPoints = points.filter((p) => p.windGusts >= 60);
  if (highGustPoints.length > 0) {
    const maxGust = Math.max(...highGustPoints.map((p) => p.windGusts));
    warnings.push(
      `Strong crosswind risk: gusts up to ${Math.round(maxGust)} km/h detected at ${highGustPoints.length} point(s) along the route. Reduce speed on exposed bridges and overpasses.`,
    );
  }

  const heavyRainPoints = points.filter((p) => p.precipitationProbability >= 70 && [63, 65, 82].includes(p.weatherCode));
  if (heavyRainPoints.length > 0) {
    warnings.push(
      `Heavy rain expected at ${heavyRainPoints.length} point(s) along the route. Reduced visibility and aquaplaning risk — increase following distance.`,
    );
  }

  const snowPoints = points.filter((p) => [71, 73, 75, 77, 85, 86].includes(p.weatherCode));
  if (snowPoints.length > 0) {
    warnings.push(
      `Snow or ice conditions at ${snowPoints.length} point(s). Check winter tire requirements and consider carrying chains.`,
    );
  }

  const fogPoints = points.filter((p) => p.visibility < 1000 || [45, 48].includes(p.weatherCode));
  if (fogPoints.length > 0) {
    warnings.push(
      `Fog or very low visibility at ${fogPoints.length} point(s). Use fog lights and reduce speed significantly.`,
    );
  }

  const freezingPoints = points.filter((p) => p.temperature <= 2);
  if (freezingPoints.length > 0) {
    warnings.push(
      `Near-freezing temperatures (as low as ${Math.min(...freezingPoints.map((p) => p.temperature)).toFixed(0)}°C). Watch for black ice, especially on bridges and shaded sections.`,
    );
  }

  const thunderstormPoints = points.filter((p) => [95, 96, 99].includes(p.weatherCode));
  if (thunderstormPoints.length > 0) {
    warnings.push(
      `Thunderstorm activity at ${thunderstormPoints.length} point(s). Avoid stopping under bridges and watch for sudden downpours.`,
    );
  }

  return warnings;
}
