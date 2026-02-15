import { applyCountryRules } from "@/lib/routing/applyCountryRules";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logging/logger";
import {
  routeAnalysisRequestSchema,
  formatZodErrors,
} from "@/lib/validation/schemas";
import { normalizePoint, resolveLocation } from "@/lib/geocoding/geocode";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import { NextResponse } from "next/server";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const REQUEST_TIMEOUT_MS = 15_000;

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
    // Guard against oversized payloads (max ~10 KB for a route analysis request).
    // Read the raw text first so we can validate actual size, not just the
    // Content-Length header (which can be spoofed or missing).
    const MAX_BODY_BYTES = 10_240;
    const rawText = await request.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return jsonError("Request payload too large.", 413, "PAYLOAD_TOO_LARGE");
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return jsonError("Invalid request format. Please refresh the page and try again.", 400, "INVALID_JSON");
    }
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

    const providedStart = normalizePoint(body.startPoint);
    const providedEnd = normalizePoint(body.endPoint);

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
      if (orsResponse.status === 404) {
        // 404 means ORS could not find any drivable route between the two points
        if (body.avoidTolls) {
          return jsonError(
            "No route found while avoiding toll roads. Try disabling 'Avoid toll roads' or choose different locations.",
            400,
            "NO_ROUTE_AVOID_TOLLS",
          );
        }
        return jsonError(
          "No drivable route found between these locations. Make sure both points are on the European road network.",
          400,
          "NO_ROUTE",
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
    if (error instanceof Error) {
      logger.error("Route analysis failed", { requestId, durationMs, code: "GEOCODE_ERROR", message: error.message });
      return jsonError(error.message, 400, "GEOCODE_ERROR");
    }
    logger.error("Unexpected error", { requestId, durationMs, code: "INTERNAL_ERROR" });
    return jsonError("An unexpected error occurred. Please try again later.", 500, "INTERNAL_ERROR");
  }
}
