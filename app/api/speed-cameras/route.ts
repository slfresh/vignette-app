import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { fetchSpeedCameras } from "@/lib/cameras/speedCameras";
import { logger } from "@/lib/logging/logger";

/**
 * GET /api/speed-cameras?lat=48.1&lon=11.5&radius=50&country=de
 *
 * Returns speed camera locations near a GPS point from the Lufop API.
 * Requires LUFOP_API_KEY environment variable to be set.
 */
export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "speed-cameras", 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { cameras: [], error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius")) || 50;
  const country = searchParams.get("country") ?? undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { cameras: [], error: "Valid lat and lon parameters are required." },
      { status: 400 },
    );
  }

  if (!process.env.LUFOP_API_KEY) {
    return NextResponse.json({ cameras: [], available: false });
  }

  try {
    const timer = logger.time("speed-cameras-fetch");
    const cameras = await fetchSpeedCameras({
      lat,
      lon,
      radiusKm: Math.min(radius, 200),
      country,
      maxResults: 500,
    });
    timer.end({ count: cameras.length });

    return NextResponse.json({ cameras, available: true });
  } catch (error) {
    logger.error("Speed cameras fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ cameras: [], available: true });
  }
}
