import type { RoutePoint } from "@/types/vignette";

export interface RouteUrlPayload {
  start: string;
  end: string;
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
}

function parseCoordParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Read optional coordinate params from a share/deep-link URL. */
export function parseRoutePointParams(searchParams: URLSearchParams): {
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
} {
  const fromLat = parseCoordParam(searchParams.get("from_lat"));
  const fromLon = parseCoordParam(searchParams.get("from_lon"));
  const toLat = parseCoordParam(searchParams.get("to_lat"));
  const toLon = parseCoordParam(searchParams.get("to_lon"));

  const startPoint =
    fromLat !== undefined && fromLon !== undefined ? { lat: fromLat, lon: fromLon } : undefined;
  const endPoint =
    toLat !== undefined && toLon !== undefined ? { lat: toLat, lon: toLon } : undefined;

  return { startPoint, endPoint };
}

/** Build URL search params for a shareable route link. */
export function buildRouteSearchParams(
  payload: RouteUrlPayload,
  existing?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? "");
  params.set("from", payload.start.trim());
  params.set("to", payload.end.trim());

  if (payload.startPoint) {
    params.set("from_lat", String(payload.startPoint.lat));
    params.set("from_lon", String(payload.startPoint.lon));
  } else {
    params.delete("from_lat");
    params.delete("from_lon");
  }

  if (payload.endPoint) {
    params.set("to_lat", String(payload.endPoint.lat));
    params.set("to_lon", String(payload.endPoint.lon));
  } else {
    params.delete("to_lat");
    params.delete("to_lon");
  }

  return params;
}

/** Full shareable URL including coordinate params when available. */
export function buildShareUrl(origin: string, payload: RouteUrlPayload): string {
  const params = buildRouteSearchParams(payload);
  const base = origin.replace(/\/$/, "");
  return `${base}/?${params.toString()}`;
}
