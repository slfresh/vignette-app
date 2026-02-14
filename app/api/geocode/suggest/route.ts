import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logging/logger";
import { geocodeSuggestCache } from "@/lib/cache/geocodeCache";
import { geocodeSuggestQuerySchema, formatZodErrors } from "@/lib/validation/schemas";

const ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const PHOTON_GEOCODE_URL = "https://photon.komoot.io/api/";
const EUROPE_BOUNDS = {
  minLat: 34,
  maxLat: 72,
  minLon: -12,
  maxLon: 45,
};

const CITY_DISAMBIGUATION_RULES: Record<string, RegExp> = {
  osijek: /\b(croatia|hrvatska)\b/i,
};

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface OrsFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    label?: string;
    name?: string;
    layer?: string;
    gid?: string;
    locality?: string;
  };
}

function inEurope(lat: number, lon: number): boolean {
  return lat >= EUROPE_BOUNDS.minLat && lat <= EUROPE_BOUNDS.maxLat && lon >= EUROPE_BOUNDS.minLon && lon <= EUROPE_BOUNDS.maxLon;
}

function buildLabel(feature: PhotonFeature): string {
  const parts = [feature.properties?.name, feature.properties?.city, feature.properties?.state, feature.properties?.country]
    .filter((value) => Boolean(value))
    .slice(0, 4);
  return parts.length ? parts.join(", ") : "Unknown location";
}

function wofCityImportanceBoost(gid: string | undefined): number {
  if (!gid) {
    return 0;
  }
  const numericId = Number(gid.split(":").pop());
  if (!Number.isFinite(numericId)) {
    return 0;
  }
  if (numericId < 300_000_000) {
    return 3;
  }
  if (numericId < 900_000_000) {
    return 2;
  }
  return 0;
}

function scoreLabel(
  label: string,
  layer: string | undefined,
  query: string,
  locality?: string,
  name?: string,
  gid?: string,
): number {
  const normalized = label.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const wantsAddress = /\d/.test(query);
  const queryHasCountryHint = normalizedQuery.includes(",");
  const isSingleToken = !/\s|,/.test(normalizedQuery);
  let score = 0;

  if (wantsAddress && /\d/.test(label)) {
    score += 4;
  }
  if (layer === "address") {
    score += 3;
  }
  if (normalized.includes(normalizedQuery)) {
    score += 2;
  }
  if (normalized.startsWith(normalizedQuery)) {
    score += 1;
  }
  if (locality?.toLowerCase() === normalizedQuery || name?.toLowerCase() === normalizedQuery) {
    score += 3;
  }
  if (queryHasCountryHint) {
    const countryHint = normalizedQuery.split(",").pop()?.trim();
    if (countryHint && normalized.includes(countryHint)) {
      score += 3;
    }
  }
  if (!wantsAddress && isSingleToken && layer === "locality") {
    score += wofCityImportanceBoost(gid);
  }

  return score;
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "geocode-suggest", 80, 60_000);
  if (!rateLimit.allowed) {
    logger.warn("Geocode suggest rate limit hit", { scope: "geocode-suggest" });
    return NextResponse.json(
      { suggestions: [], error: "Too many suggestion requests. Please pause typing briefly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";

  // Validate the query parameter with Zod
  const parseResult = geocodeSuggestQuerySchema.safeParse({ q: rawQuery });
  if (!parseResult.success) {
    // For autocomplete, return empty suggestions instead of an error when query is too short
    const isTooShort = parseResult.error.issues.some((issue) => issue.code === "too_small");
    if (isTooShort) {
      return NextResponse.json({ suggestions: [] });
    }
    return NextResponse.json(
      { suggestions: [], error: formatZodErrors(parseResult.error) },
      { status: 400 },
    );
  }

  const query = parseResult.data.q;

  // Check cache before making external API calls
  const cacheKey = query.toLowerCase();
  const cachedSuggestions = geocodeSuggestCache.get(cacheKey);
  if (cachedSuggestions) {
    return NextResponse.json({ suggestions: cachedSuggestions }, { status: 200 });
  }

  const orsApiKey = process.env.ORS_API_KEY?.trim();
  const collected: Array<{ label: string; lat: number; lon: number; score: number }> = [];

  if (orsApiKey) {
    try {
      const orsUrl = `${ORS_GEOCODE_URL}?text=${encodeURIComponent(query)}&size=8`;
      const orsResponse = await fetch(orsUrl, {
        cache: "no-store",
        headers: { Authorization: orsApiKey },
      });
      if (orsResponse.ok) {
        const orsPayload = (await orsResponse.json()) as { features?: OrsFeature[] };
        for (const feature of orsPayload.features ?? []) {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates || coordinates.length !== 2) {
            continue;
          }
          const lon = Number(coordinates[0]);
          const lat = Number(coordinates[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) {
            continue;
          }
          const label = feature.properties?.label ?? feature.properties?.name ?? "Unknown location";
          collected.push({
            label,
            lat,
            lon,
            score: scoreLabel(
              label,
              feature.properties?.layer,
              query,
              feature.properties?.locality,
              feature.properties?.name,
              feature.properties?.gid,
            ),
          });
        }
      }
    } catch {
      // Fallback to Photon below.
    }
  }

  if (collected.length < 8) {
    try {
      const photonUrl = `${PHOTON_GEOCODE_URL}?q=${encodeURIComponent(query)}&limit=8`;
      const photonResponse = await fetch(photonUrl, { cache: "no-store" });
      if (photonResponse.ok) {
        const photonPayload = (await photonResponse.json()) as { features?: PhotonFeature[] };
        for (const feature of photonPayload.features ?? []) {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates || coordinates.length !== 2) {
            continue;
          }
          const lon = Number(coordinates[0]);
          const lat = Number(coordinates[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) {
            continue;
          }
          const label = buildLabel(feature);
          collected.push({
            label,
            lat,
            lon,
            score: scoreLabel(label, undefined, query),
          });
        }
      }
    } catch {
      // Return best effort from collected values.
    }
  }

  const deduped = new Map<string, { label: string; lat: number; lon: number; score: number }>();
  for (const item of collected) {
    const key = `${item.label}|${item.lat.toFixed(6)}|${item.lon.toFixed(6)}`;
    const current = deduped.get(key);
    if (!current || item.score > current.score) {
      deduped.set(key, item);
    }
  }

  let suggestions = Array.from(deduped.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ label, lat, lon }) => ({ label, lat, lon }));

  const normalizedQuery = query.trim().toLowerCase();
  const disambiguationPattern = CITY_DISAMBIGUATION_RULES[normalizedQuery];
  if (disambiguationPattern) {
    const preferred = suggestions.find((entry) => disambiguationPattern.test(entry.label));
    if (preferred) {
      suggestions = [preferred, ...suggestions.filter((entry) => entry !== preferred)];
    }
  }

  // Cache the final suggestions for faster subsequent lookups
  if (suggestions.length > 0) {
    geocodeSuggestCache.set(cacheKey, suggestions);
  }

  return NextResponse.json({ suggestions }, { status: 200 });
}
