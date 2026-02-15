import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logging/logger";

const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
const GEOCODE_TIMEOUT_MS = 8_000;

interface PhotonFeature {
  properties?: {
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    name?: string;
  };
}

function buildLabel(feature: PhotonFeature): string {
  const p = feature.properties;
  if (!p) return "Unknown location";

  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  else if (p.street) {
    parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
  }
  if (p.city) parts.push(p.city);
  if (p.state && p.state !== p.city) parts.push(p.state);
  if (p.country) parts.push(p.country);

  return parts.length ? parts.slice(0, 4).join(", ") : "Unknown location";
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "geocode-reverse", 60, 60_000);
  if (!rateLimit.allowed) {
    logger.warn("Reverse geocode rate limit hit", { scope: "geocode-reverse" });
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid lat/lon" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Lat/lon out of range" }, { status: 400 });
  }

  try {
    const url = `${PHOTON_REVERSE_URL}?lat=${lat}&lon=${lon}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const response = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => clearTimeout(timeoutId));
    if (!response.ok) {
      return NextResponse.json({ label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
    }

    const data = (await response.json()) as { features?: PhotonFeature[] };
    const feature = data.features?.[0];
    const label = feature ? buildLabel(feature) : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    return NextResponse.json({ label, lat, lon });
  } catch {
    return NextResponse.json({ label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon });
  }
}
