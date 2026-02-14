import { applyCountryRules } from "@/lib/routing/applyCountryRules";
import { geocodeAddressCache } from "@/lib/cache/geocodeCache";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logging/logger";
import {
  routeAnalysisRequestSchema,
  formatZodErrors,
} from "@/lib/validation/schemas";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type { RoutePoint } from "@/types/vignette";
import { NextResponse } from "next/server";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const PHOTON_GEOCODE_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_CONTACT_EMAIL = "support@example.com";
const EUROPE_BOUNDS = {
  minLat: 34,
  maxLat: 72,
  minLon: -12,
  maxLon: 45,
};

function getNominatimUserAgent() {
  const contactEmail = process.env.APP_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  return `EuropeanVignettePortal/1.0 (contact: ${contactEmail})`;
}

function normalizePoint(rawValue: string): RoutePoint | null {
  const parts = rawValue.split(",").map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return { lat, lon };
}

function isLikelyEurope(point: RoutePoint): boolean {
  return (
    point.lat >= EUROPE_BOUNDS.minLat &&
    point.lat <= EUROPE_BOUNDS.maxLat &&
    point.lon >= EUROPE_BOUNDS.minLon &&
    point.lon <= EUROPE_BOUNDS.maxLon
  );
}

function normalizeProvidedPoint(point: RoutePoint | undefined): RoutePoint | null {
  if (!point) {
    return null;
  }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
    return null;
  }
  if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    return null;
  }
  return { lat: point.lat, lon: point.lon };
}

async function geocodeAddress(query: string): Promise<RoutePoint> {
  // Check cache first to avoid redundant API calls
  const cacheKey = query.trim().toLowerCase();
  const cached = geocodeAddressCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const orsApiKey = process.env.ORS_API_KEY?.trim();
  if (orsApiKey) {
    try {
      const orsPoint = await geocodeAddressWithOrs(query, orsApiKey);
      if (isLikelyEurope(orsPoint)) {
        geocodeAddressCache.set(cacheKey, orsPoint);
        return orsPoint;
      }
    } catch {
      // Continue to public geocoder fallback when ORS geocoding is not available.
    }
  }

  try {
    const photonPoint = await geocodeAddressWithPhoton(query);
    if (isLikelyEurope(photonPoint)) {
      geocodeAddressCache.set(cacheKey, photonPoint);
      return photonPoint;
    }
  } catch {
    // Continue to next fallback.
  }

  try {
    const nominatimPoint = await geocodeAddressWithNominatim(query);
    if (isLikelyEurope(nominatimPoint)) {
      geocodeAddressCache.set(cacheKey, nominatimPoint);
      return nominatimPoint;
    }
  } catch {
    throw new Error(`Could not resolve "${query}". Check spelling or try a more specific name with country (e.g., "Lyon, France").`);
  }

  throw new Error(`Could not confidently locate "${query}" in Europe. Try adding a country name (e.g., "Luter, France").`);
}

async function geocodeAddressWithOrs(query: string, apiKey: string): Promise<RoutePoint> {
  const url = `${ORS_GEOCODE_URL}?text=${encodeURIComponent(query)}&size=1`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`ORS geocoding failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length !== 2) {
    throw new Error("ORS geocoding returned no result.");
  }

  return {
    lon: Number(coordinates[0]),
    lat: Number(coordinates[1]),
  };
}

async function geocodeAddressWithNominatim(query: string): Promise<RoutePoint> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": getNominatimUserAgent(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status}).`);
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const match = data[0];
  if (!match) {
    throw new Error("Could not resolve one of the locations.");
  }

  return {
    lat: Number(match.lat),
    lon: Number(match.lon),
  };
}

async function geocodeAddressWithPhoton(query: string): Promise<RoutePoint> {
  const url = `${PHOTON_GEOCODE_URL}?q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Photon geocoding failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length !== 2) {
    throw new Error("Photon geocoding returned no result.");
  }

  return {
    lon: Number(coordinates[0]),
    lat: Number(coordinates[1]),
  };
}

async function resolveLocation(input: string): Promise<RoutePoint> {
  const coordinatePoint = normalizePoint(input);
  if (coordinatePoint) {
    return coordinatePoint;
  }
  return geocodeAddress(input);
}

/**
 * Return a structured JSON error response with:
 * - error: human-readable message for display
 * - code: machine-readable code for programmatic handling
 */
function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code: code ?? "UNKNOWN" }, { status });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  const rateLimit = await checkRateLimit(request, "route-analysis", 30, 60_000);
  if (!rateLimit.allowed) {
    logger.warn("Rate limit hit", { requestId, scope: "route-analysis" });
    return NextResponse.json(
      {
        error: "Too many route requests. Please wait and try again.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    // Parse and validate the request body with Zod
    const rawBody: unknown = await request.json();
    const parseResult = routeAnalysisRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return jsonError(formatZodErrors(parseResult.error), 400, "VALIDATION_ERROR");
    }

    const body = parseResult.data;
    logger.info("Route analysis started", { requestId, from: body.start, to: body.end });

    if (!process.env.ORS_API_KEY) {
      return jsonError(
        "The server is not configured for routing. Please contact the site operator.",
        500,
        "MISSING_API_KEY",
      );
    }

    const providedStart = normalizeProvidedPoint(body.startPoint);
    const providedEnd = normalizeProvidedPoint(body.endPoint);
    const [startPoint, endPoint] = await Promise.all([
      providedStart ? Promise.resolve(providedStart) : resolveLocation(body.start.trim()),
      providedEnd ? Promise.resolve(providedEnd) : resolveLocation(body.end.trim()),
    ]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const avoidFeatures = new Set<string>();
    if (body.avoidTolls) {
      avoidFeatures.add("tollways");
    }

    const orsResponse = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [startPoint.lon, startPoint.lat],
          [endPoint.lon, endPoint.lat],
        ],
        instructions: false,
        extra_info: ["countryinfo", "waycategory"],
        options: avoidFeatures.size
          ? {
              avoid_features: Array.from(avoidFeatures),
            }
          : undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeoutId));

    if (!orsResponse.ok) {
      if (orsResponse.status === 401 || orsResponse.status === 403) {
        return jsonError(
          "The routing service rejected the API key. Please contact the site operator.",
          502,
          "ORS_AUTH_FAILED",
        );
      }
      if (orsResponse.status === 404 && body.avoidTolls) {
        return jsonError(
          "No route found while avoiding toll roads. Try disabling 'Avoid toll roads' or choose different locations.",
          400,
          "NO_ROUTE_AVOID_TOLLS",
        );
      }
      if (orsResponse.status === 400) {
        return jsonError(
          "Could not build a route between these locations. Try more specific place names including the country (e.g., \"Munich, Germany\").",
          400,
          "NO_ROUTE",
        );
      }
      if (orsResponse.status === 429) {
        return jsonError(
          "The routing service is temporarily busy. Please wait a moment and try again.",
          429,
          "ORS_RATE_LIMITED",
        );
      }
      return jsonError(
        `The routing service returned an unexpected error (${orsResponse.status}). Please try again later.`,
        502,
        "ORS_ERROR",
      );
    }

    const routePayload = (await orsResponse.json()) as OrsDirectionsResponse;
    const result = applyCountryRules(routePayload, body);
    result.appliedPreferences = {
      avoidTolls: Boolean(body.avoidTolls),
      channelCrossingPreference: body.channelCrossingPreference ?? "auto",
      vehicleClass: body.vehicleClass ?? "PASSENGER_CAR_M1",
      powertrainType: body.powertrainType ?? "PETROL",
      grossWeightKg: body.grossWeightKg,
      axles: body.axles,
      emissionClass: body.powertrainType === "ELECTRIC" ? "ZERO_EMISSION" : body.emissionClass ?? "UNKNOWN",
    };

    const durationMs = Date.now() - startTime;
    logger.info("Route analysis completed", {
      requestId,
      durationMs,
      countries: result.countries?.length ?? 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("Route analysis timed out", { requestId, durationMs, code: "TIMEOUT" });
      return jsonError(
        "Route analysis timed out. The routing service may be slow — please try again.",
        504,
        "TIMEOUT",
      );
    }
    if (error instanceof SyntaxError) {
      logger.warn("Invalid request body", { requestId, durationMs, code: "INVALID_JSON" });
      return jsonError("Invalid request format. Please refresh the page and try again.", 400, "INVALID_JSON");
    }
    if (error instanceof Error) {
      logger.error("Route analysis failed", { requestId, durationMs, code: "GEOCODE_ERROR", message: error.message });
      return jsonError(error.message, 400, "GEOCODE_ERROR");
    }
    logger.error("Unexpected error", { requestId, durationMs, code: "INTERNAL_ERROR" });
    return jsonError("An unexpected error occurred. Please try again later.", 500, "INTERNAL_ERROR");
  }
}
