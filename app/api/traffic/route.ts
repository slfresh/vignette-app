import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { fetchTrafficIncidents } from "@/lib/traffic/tomtom";
import { getTrafficFlowTileUrl, getTrafficIncidentTileUrl } from "@/lib/traffic/tomtom";
import { logger } from "@/lib/logging/logger";

/**
 * GET /api/traffic?lat=48.1&lon=11.5&radius=50
 *
 * Returns traffic incidents near a GPS point and tile URLs for the traffic overlay.
 * Requires TOMTOM_API_KEY environment variable.
 */
export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "traffic", 20, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { incidents: [], error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      incidents: [],
      available: false,
      tileUrls: null,
    });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius")) || 50;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { incidents: [], error: "Valid lat and lon parameters are required." },
      { status: 400 },
    );
  }

  try {
    const timer = logger.time("traffic-fetch");
    const incidents = await fetchTrafficIncidents({
      lat,
      lon,
      radiusKm: Math.min(radius, 200),
    });
    timer.end({ count: incidents.length });

    return NextResponse.json({
      incidents,
      available: true,
      tileUrls: {
        flow: getTrafficFlowTileUrl(apiKey),
        incidents: getTrafficIncidentTileUrl(apiKey),
      },
    });
  } catch (error) {
    logger.error("Traffic fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ incidents: [], available: true, tileUrls: null });
  }
}
