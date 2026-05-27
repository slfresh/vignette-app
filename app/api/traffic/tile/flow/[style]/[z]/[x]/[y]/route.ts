import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTrafficFlowTileUrl } from "@/lib/traffic/tomtom";

const VALID_FLOW_STYLES = new Set(["absolute", "relative", "relative-delay", "relative0", "relative-delay0"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ style: string; z: string; x: string; y: string }> },
) {
  const rateLimit = await checkRateLimit(_request, "traffic-tile", 120, 60_000);
  if (!rateLimit.allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const apiKey = process.env.TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    return new NextResponse("Traffic tiles unavailable", { status: 503 });
  }

  const { style, z, x, y } = await context.params;
  if (!VALID_FLOW_STYLES.has(style)) {
    return new NextResponse("Invalid flow style", { status: 400 });
  }

  const upstreamUrl = getTrafficFlowTileUrl(apiKey, style)
    .replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y);

  try {
    const resp = await fetch(upstreamUrl, { next: { revalidate: 300 } });
    if (!resp.ok) return new NextResponse("Upstream tile error", { status: resp.status });
    const buffer = await resp.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new NextResponse("Tile fetch failed", { status: 502 });
  }
}
