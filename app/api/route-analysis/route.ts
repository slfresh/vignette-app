import { applyCountryRules } from "@/lib/routing/applyCountryRules";
import { checkRateLimit } from "@/lib/security/rateLimit";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type { RouteAnalysisRequest, RoutePoint } from "@/types/vignette";
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
  const orsApiKey = process.env.ORS_API_KEY?.trim();
  if (orsApiKey) {
    try {
      const orsPoint = await geocodeAddressWithOrs(query, orsApiKey);
      if (isLikelyEurope(orsPoint)) {
        return orsPoint;
      }
    } catch {
      // Continue to public geocoder fallback when ORS geocoding is not available.
    }
  }

  try {
    const photonPoint = await geocodeAddressWithPhoton(query);
    if (isLikelyEurope(photonPoint)) {
      return photonPoint;
    }
  } catch {
    // Continue to next fallback.
  }

  const nominatimPoint = await geocodeAddressWithNominatim(query);
  if (isLikelyEurope(nominatimPoint)) {
    return nominatimPoint;
  }

  throw new Error(`Could not confidently resolve "${query}" in Europe. Try adding country (e.g., "Luter, France").`);
}

async function geocodeAddressWithOrs(query: string, apiKey: string): Promise<RoutePoint> {
  const url = `${ORS_GEOCODE_URL}?api_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(query)}&size=1`;
  const response = await fetch(url, {
    cache: "no-store",
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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "route-analysis", 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many route requests. Please wait and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const body = (await request.json()) as RouteAnalysisRequest;
    if (!body.start?.trim() || !body.end?.trim()) {
      return jsonError("Start and end are required.", 400);
    }
    if (body.start.length > 180 || body.end.length > 180) {
      return jsonError("Start or destination is too long. Please shorten the input.", 400);
    }
    if (
      body.grossWeightKg !== undefined &&
      (!Number.isFinite(body.grossWeightKg) || body.grossWeightKg <= 0 || body.grossWeightKg > 60_000)
    ) {
      return jsonError("Gross weight must be between 1 and 60000 kg.", 400);
    }
    if (body.axles !== undefined && (!Number.isFinite(body.axles) || body.axles < 1 || body.axles > 8)) {
      return jsonError("Axles must be between 1 and 8.", 400);
    }

    if (!process.env.ORS_API_KEY) {
      return jsonError("Server is missing ORS_API_KEY.", 500);
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
          "OpenRouteService key is invalid or does not have access to Directions API. Verify your key and restrictions in ORS dashboard.",
          502,
        );
      }
      if (orsResponse.status === 404 && body.avoidTolls) {
        return jsonError("No route found with current avoid-tolls preference. Try disabling 'Avoid toll roads'.", 400);
      }
      if (orsResponse.status === 400) {
        return jsonError("Could not build route from current locations. Try more specific place names with country.", 400);
      }
      const status = orsResponse.status === 429 ? 429 : 502;
      return jsonError(`Routing provider returned ${orsResponse.status}.`, status);
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

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Route analysis timed out. Please try again.", 504);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    return jsonError("Unexpected server error.", 500);
  }
}
