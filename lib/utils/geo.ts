import type { RoutePoint } from "@/types/vignette";

/** Haversine distance between two lat/lon points, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Conservative ORS driving-car service area for continental Europe, UK, and Scandinavia. */
export const EUROPE_BOUNDS = {
  minLat: 34,
  maxLat: 72,
  minLon: -25,
  maxLon: 45,
} as const;

export function isWithinEuropeBounds(point: RoutePoint): boolean {
  return (
    point.lat >= EUROPE_BOUNDS.minLat &&
    point.lat <= EUROPE_BOUNDS.maxLat &&
    point.lon >= EUROPE_BOUNDS.minLon &&
    point.lon <= EUROPE_BOUNDS.maxLon
  );
}

export class OutsideEuropeBoundsError extends Error {
  constructor(label: string) {
    super(
      `"${label}" is outside the European road network coverage area. Use a location within Europe (e.g., "Munich, Germany").`,
    );
    this.name = "OutsideEuropeBoundsError";
  }
}

export function assertWithinEuropeBounds(point: RoutePoint, label: string): void {
  if (!isWithinEuropeBounds(point)) {
    throw new OutsideEuropeBoundsError(label);
  }
}
