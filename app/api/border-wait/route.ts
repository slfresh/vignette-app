import { NextResponse } from "next/server";
import { getRouteCrossingSources } from "@/lib/border/sources";
import { checkRateLimit } from "@/lib/security/rateLimit";
import type { CountryCode } from "@/types/vignette";

const CACHE_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

type WaitRecord = {
  crossingCode: string;
  crossingLabel: string;
  minutes: number | null;
  display: string;
  sourceLabel: string;
  sourceUrl: string;
  reliability: "official" | "aggregated" | "unknown";
};

type CacheEntry = {
  expiresAt: number;
  payload: {
    waits: WaitRecord[];
    updatedAt: string;
  };
};

const CACHE = new Map<string, CacheEntry>();

function normalizeRouteParam(raw: string | null): CountryCode[] {
  if (!raw) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length === 2);

  // Guardrail against abuse: pathologically long query strings.
  return parts.slice(0, 24) as CountryCode[];
}

function normalizeText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinutesNearKeyword(content: string, keywords: string[]): number | null {
  const text = content.toLowerCase();
  for (const keyword of keywords) {
    const index = text.indexOf(keyword);
    if (index < 0) {
      continue;
    }
    const windowText = text.slice(Math.max(0, index - 40), index + 220);

    const minuteMatch = windowText.match(/(\d{1,3})\s*(min|minute|minutes|perc)/i);
    if (minuteMatch) {
      return Number(minuteMatch[1]);
    }

    const hourMatch = windowText.match(/(\d{1,2})\s*(h|hr|hour|hours|ora|oras)/i);
    if (hourMatch) {
      return Number(hourMatch[1]) * 60;
    }
  }
  return null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "Live data unavailable, open source";
  }
  if (minutes < 60) {
    return `~${minutes} min`;
  }
  const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
  return `~${hours} h`;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "EuroDrive/1.0 border wait fetcher",
      },
    });
    if (!response.ok) {
      throw new Error(`source ${response.status}`);
    }
    return normalizeText(await response.text());
  } finally {
    clearTimeout(timeoutId);
  }
}

function getKeywordsForCrossing(crossingCode: string): string[] {
  if (crossingCode === "HU-RS") {
    return ["roszke", "röszke", "horgos", "horgoš"];
  }
  if (crossingCode === "RS-BG") {
    return ["gradina", "kalotina"];
  }
  if (crossingCode === "BG-TR") {
    return ["kapikule", "hamzabeyli", "kapitan andreevo"];
  }
  return [];
}

async function collectWaitRecords(routeCountries: CountryCode[]): Promise<WaitRecord[]> {
  const crossings = getRouteCrossingSources(routeCountries);
  const grouped = new Map<string, typeof crossings>();

  for (const source of crossings) {
    const existing = grouped.get(source.crossingCode);
    if (existing) {
      existing.push(source);
    } else {
      grouped.set(source.crossingCode, [source]);
    }
  }

  const waits: WaitRecord[] = [];
  for (const [crossingCode, sources] of grouped.entries()) {
    const keywords = getKeywordsForCrossing(crossingCode);
    let resolved: WaitRecord | null = null;

    for (const source of sources) {
      try {
        const text = await fetchText(source.url);
        const minutes = parseMinutesNearKeyword(text, keywords);
        resolved = {
          crossingCode,
          crossingLabel: source.crossingLabel,
          minutes,
          display: formatMinutes(minutes),
          sourceLabel: source.label,
          sourceUrl: source.url,
          reliability: minutes === null ? "unknown" : source.kind,
        };
        if (minutes !== null) {
          break;
        }
      } catch {
        // Keep trying fallback sources for the same crossing.
      }
    }

    if (!resolved) {
      const fallbackSource = sources[0];
      resolved = {
        crossingCode,
        crossingLabel: fallbackSource?.crossingLabel ?? crossingCode,
        minutes: null,
        display: "Live data unavailable, open source",
        sourceLabel: fallbackSource?.label ?? "Official source",
        sourceUrl: fallbackSource?.url ?? "#",
        reliability: "unknown",
      };
    }

    waits.push(resolved);
  }

  return waits;
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "border-wait", 40, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { waits: [], error: "Too many border wait requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const routeParam = searchParams.get("route");
  if ((routeParam?.length ?? 0) > 160) {
    return NextResponse.json({ waits: [], error: "Route parameter too long." }, { status: 400 });
  }

  const routeCountries = normalizeRouteParam(routeParam);
  if (routeCountries.length < 2) {
    return NextResponse.json({ waits: [], updatedAt: new Date().toISOString() }, { status: 200 });
  }

  const cacheKey = routeCountries.join(",");
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, { status: 200 });
  }

  const waits = await collectWaitRecords(routeCountries);
  const payload = {
    waits,
    updatedAt: new Date().toISOString(),
  };

  CACHE.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });

  return NextResponse.json(payload, { status: 200 });
}
