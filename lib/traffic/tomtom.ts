/**
 * TomTom Traffic API integration.
 *
 * Provides two features:
 * 1. Traffic flow tile layer (overlay on Leaflet map)
 * 2. Traffic incidents along a route corridor
 *
 * Requires TOMTOM_API_KEY environment variable.
 * Free tier: 2,500 requests/day.
 *
 * @see https://developer.tomtom.com/traffic-api/documentation
 */

import { logger } from "@/lib/logging/logger";

const TOMTOM_BASE = "https://api.tomtom.com";
const TOMTOM_TIMEOUT_MS = 10_000;

/**
 * TomTom traffic flow tile URL template for Leaflet TileLayer.
 *
 * Style options:
 *  - "absolute": color-coded speed
 *  - "relative": speed relative to free flow
 *  - "relative-delay": only shows delayed segments
 */
export function getTrafficFlowTileUrl(apiKey: string, style: string = "relative"): string {
  return `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/{z}/{x}/{y}.png?key=${apiKey}&tileSize=256`;
}

/**
 * TomTom traffic incident tile URL template for Leaflet TileLayer.
 */
export function getTrafficIncidentTileUrl(apiKey: string): string {
  return `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${apiKey}&tileSize=256`;
}

/** A traffic incident from TomTom. */
export interface TrafficIncident {
  id: string;
  type: string;
  severity: "minor" | "moderate" | "major" | "undefined";
  description: string;
  lat: number;
  lon: number;
  from: string;
  to: string;
  delay: number;
  roadName: string;
}

/** Raw TomTom incident response shape. */
interface TomTomIncidentResult {
  incidents?: Array<{
    type: string;
    properties: {
      id: string;
      magnitudeOfDelay?: number;
      events?: Array<{ description: string; code: number }>;
      from?: string;
      to?: string;
      roadNumbers?: string[];
    };
    geometry: {
      type: string;
      coordinates: number[] | number[][];
    };
  }>;
}

function parseSeverity(magnitude: number | undefined): TrafficIncident["severity"] {
  if (magnitude === undefined) return "undefined";
  if (magnitude <= 1) return "minor";
  if (magnitude <= 2) return "moderate";
  return "major";
}

/**
 * Fetch traffic incidents near a GPS point.
 */
export async function fetchTrafficIncidents(options: {
  lat: number;
  lon: number;
  radiusKm?: number;
}): Promise<TrafficIncident[]> {
  const apiKey = process.env.TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    logger.debug("TOMTOM_API_KEY not set, traffic incidents disabled");
    return [];
  }

  const { lat, lon, radiusKm = 50 } = options;

  // Bounding box approach: convert radius to lat/lon offset
  const latOffset = radiusKm / 111;
  const lonOffset = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const bbox = `${(lon - lonOffset).toFixed(6)},${(lat - latOffset).toFixed(6)},${(lon + lonOffset).toFixed(6)},${(lat + latOffset).toFixed(6)}`;

  const url = `${TOMTOM_BASE}/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{id,magnitudeOfDelay,events{description,code},from,to,roadNumbers}}}&language=en-US&timeValidityFilter=present`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOMTOM_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timeoutId));

    if (!resp.ok) {
      logger.warn("TomTom incidents API error", { status: resp.status });
      return [];
    }

    const data = (await resp.json()) as TomTomIncidentResult;
    if (!data.incidents?.length) return [];

    return data.incidents
      .map((inc): TrafficIncident | null => {
        const coords = inc.geometry.coordinates;
        let incLat: number, incLon: number;

        if (inc.geometry.type === "Point" && typeof coords[0] === "number") {
          [incLon, incLat] = coords as number[];
        } else if (Array.isArray(coords[0])) {
          const firstPt = coords[0] as number[];
          [incLon, incLat] = firstPt;
        } else {
          return null;
        }

        const desc = inc.properties.events?.[0]?.description ?? inc.type;
        return {
          id: inc.properties.id,
          type: inc.type,
          severity: parseSeverity(inc.properties.magnitudeOfDelay),
          description: desc,
          lat: incLat,
          lon: incLon,
          from: inc.properties.from ?? "",
          to: inc.properties.to ?? "",
          delay: inc.properties.magnitudeOfDelay ?? 0,
          roadName: inc.properties.roadNumbers?.[0] ?? "",
        };
      })
      .filter((item): item is TrafficIncident => item !== null);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("TomTom incidents request timed out");
    } else {
      logger.warn("TomTom incidents fetch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }
}
