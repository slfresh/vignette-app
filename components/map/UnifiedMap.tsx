"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import L from "leaflet";
import { LatLngBounds } from "leaflet";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import type { CountryCode, RouteLineString, RoutePoint } from "@/types/vignette";
import { getAllCameraFeeds } from "@/lib/border/cameraPins";
import { useI18n } from "@/components/i18n/I18nProvider";

/* ─── Tile configuration ─── */
const TILE_LIGHT = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/* ─── Default center (Europe) ─── */
const DEFAULT_CENTER: [number, number] = [48.5, 13.5];
const DEFAULT_ZOOM = 5;

/* ─── Marker icons ─── */

/** Green A marker for start */
const startIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#22c55e;color:white;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">A</div>`,
  className: "map-picker-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Red B marker for destination */
const destIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#ef4444;color:white;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">B</div>`,
  className: "map-picker-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Blue pulsing dot for user's geolocation */
const geoIcon = L.divIcon({
  html: `<div class="geo-dot"></div>`,
  className: "geo-dot-wrapper",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Camera icon SVG for border crossing pins */
const cameraIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;

const cameraIcon = L.divIcon({
  html: `<div class="camera-icon-circle">${cameraIconSvg}</div>`,
  className: "border-camera-pin",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

/* ─── Flag/country helpers ─── */
const FLAG_EMOJI: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CZ: "🇨🇿", SK: "🇸🇰", HU: "🇭🇺", SI: "🇸🇮", CH: "🇨🇭", RO: "🇷🇴",
  BG: "🇧🇬", HR: "🇭🇷", RS: "🇷🇸", DK: "🇩🇰", SE: "🇸🇪", NL: "🇳🇱", BE: "🇧🇪", FR: "🇫🇷",
  IT: "🇮🇹", BA: "🇧🇦", ME: "🇲🇪", XK: "🇽🇰", MK: "🇲🇰", AL: "🇦🇱", PL: "🇵🇱", ES: "🇪🇸",
  PT: "🇵🇹", GB: "🇬🇧", IE: "🇮🇪", TR: "🇹🇷", GR: "🇬🇷",
};

const COUNTRY_NAME: Record<string, string> = {
  DE: "Germany", AT: "Austria", CZ: "Czechia", SK: "Slovakia", HU: "Hungary",
  SI: "Slovenia", CH: "Switzerland", RO: "Romania", BG: "Bulgaria", HR: "Croatia",
  RS: "Serbia", DK: "Denmark", SE: "Sweden", NL: "Netherlands", BE: "Belgium",
  FR: "France", IT: "Italy", BA: "Bosnia", ME: "Montenegro", XK: "Kosovo",
  MK: "N. Macedonia", AL: "Albania", PL: "Poland", ES: "Spain", PT: "Portugal",
  GB: "UK", IE: "Ireland", TR: "Turkey", GR: "Greece",
};

function getFlag(code: string): string {
  return FLAG_EMOJI[code] ?? "🏳️";
}
function getCountryName(code: string): string {
  return COUNTRY_NAME[code] ?? code;
}

/** Creates a flag-pair icon for plain border crossings (no camera). */
function createBorderIcon(codeFrom: string, codeTo: string): L.DivIcon {
  const flagFrom = FLAG_EMOJI[codeFrom] ?? "🏳️";
  const flagTo = FLAG_EMOJI[codeTo] ?? "🏳️";
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;gap:1px;width:44px;height:26px;border-radius:13px;background:var(--surface);border:2px solid var(--border-strong);box-shadow:0 2px 4px rgba(0,0,0,0.15);font-size:13px;line-height:1">${flagFrom}${flagTo}</div>`,
    className: "border-crossing-pin",
    iconSize: [44, 26],
    iconAnchor: [22, 13],
    popupAnchor: [0, -13],
  });
}

/* ─── Reverse geocoding helper ─── */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
    if (!res.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const data = (await res.json()) as { label?: string };
    return data.label ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

/* ─── Dark-mode detection (uses useSyncExternalStore to avoid set-state-in-effect) ─── */
function subscribeDarkMode(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function getDarkModeSnapshot(): boolean {
  return document.documentElement.classList.contains("theme-dark");
}
function getDarkModeServerSnapshot(): boolean {
  return false;
}
function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeDarkMode, getDarkModeSnapshot, getDarkModeServerSnapshot);
}

/* ─── Inner Leaflet helpers ─── */

/** Dynamically swaps tile layers when theme changes. */
function DynamicTileLayer({ isDark }: { isDark: boolean }) {
  const map = useMap();
  useEffect(() => {
    const config = isDark ? TILE_DARK : TILE_LIGHT;
    const layer = L.tileLayer(config.url, { attribution: config.attribution });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [isDark, map]);
  return null;
}

/** Invalidates map size after fullscreen toggles. */
function MapResizeHandler({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

/** Fits the map to route bounds when coordinates change. */
function FitBounds({ bounds }: { bounds: LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

/** Pans the map to the user's geolocation once it's available. */
function PanToGeo({ position }: { position: { lat: number; lon: number } | null }) {
  const map = useMap();
  const panDoneRef = useRef(false);
  useEffect(() => {
    if (position && !panDoneRef.current) {
      panDoneRef.current = true;
      map.setView([position.lat, position.lon], 10, { animate: true });
    }
  }, [position, map]);
  return null;
}

/** Handles clicks on the map for picking start/destination. */
function MapClickHandler({
  pickMode,
  onPick,
  setPickMode,
}: {
  pickMode: "start" | "end" | null;
  onPick: (mode: "start" | "end", label: string, point: RoutePoint) => void;
  setPickMode: (mode: "start" | "end" | null) => void;
}) {
  const loadingRef = useRef(false);
  useMapEvents({
    click: async (e: L.LeafletMouseEvent) => {
      if (!pickMode || loadingRef.current) return;
      loadingRef.current = true;
      const { lat, lng } = e.latlng;
      try {
        const label = await reverseGeocode(lat, lng);
        onPick(pickMode, label, { lat, lon: lng });
        setPickMode(null);
      } finally {
        loadingRef.current = false;
      }
    },
  });
  return null;
}

/* ─── Props ─── */
export interface UnifiedMapProps {
  /* ── Input mode (picking start/destination) ── */
  startPoint?: RoutePoint | null;
  endPoint?: RoutePoint | null;
  onSelectStart: (label: string, point: RoutePoint) => void;
  onSelectDestination: (label: string, point: RoutePoint) => void;

  /* ── Route mode (after calculation) ── */
  routeCoordinates?: [number, number][];
  highlightedCountryCode?: CountryCode | null;
  highlightedSegments?: RouteLineString[];
  borderCrossings?: Array<{
    countryCodeFrom: CountryCode;
    countryCodeTo: CountryCode;
    lat: number;
    lon: number;
  }>;
  showBorderCameras?: boolean;
  onToggleBorderCameras?: (next: boolean) => void;
  hasBorderCameraData?: boolean;

  /* ── Geolocation ── */
  geoPosition?: { lat: number; lon: number } | null;
  geoLoading?: boolean;
}

/* ─── Main component ─── */
export const UnifiedMap = memo(function UnifiedMap({
  startPoint,
  endPoint,
  onSelectStart,
  onSelectDestination,
  routeCoordinates,
  highlightedCountryCode,
  highlightedSegments = [],
  borderCrossings = [],
  showBorderCameras = false,
  onToggleBorderCameras,
  hasBorderCameraData = false,
  geoPosition,
  geoLoading = false,
}: UnifiedMapProps) {
  const { t } = useI18n();
  const isDark = useIsDarkMode();

  /* Pick mode state for A/B buttons */
  const [pickMode, setPickMode] = useState<"start" | "end" | null>(null);

  /* Fullscreen state */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Is the map in "route mode"? (route has been calculated) */
  const hasRoute = !!routeCoordinates && routeCoordinates.length > 0;

  /* ── Route positions (convert [lon,lat] from ORS to [lat,lon] for Leaflet) ── */
  const routePositions = useMemo(
    () => (routeCoordinates ?? []).map(([lon, lat]) => [lat, lon] as [number, number]),
    [routeCoordinates],
  );

  const routeBounds = useMemo(
    () => (routePositions.length > 0 ? new LatLngBounds(routePositions) : null),
    [routePositions],
  );

  const highlightedPositions = useMemo(
    () => highlightedSegments.map((seg) => seg.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
    [highlightedSegments],
  );

  /* ── Camera feeds ── */
  const allCameraFeeds = useMemo(() => getAllCameraFeeds(), []);

  /**
   * Always show ALL border cameras when the toggle is on.
   * This lets users verify every camera pin position and check
   * border situations even without entering a route.
   */

  /* When camera toggle is off: show plain border markers. When on: cameras replace them. */
  const plainBorderCrossings = showBorderCameras ? [] : borderCrossings;

  /* ── Handlers ── */
  const handlePick = useCallback(
    (mode: "start" | "end", label: string, point: RoutePoint) => {
      if (mode === "start") onSelectStart(label, point);
      else onSelectDestination(label, point);
    },
    [onSelectStart, onSelectDestination],
  );

  const handleCameraToggle = useCallback(() => {
    onToggleBorderCameras?.(!showBorderCameras);
  }, [onToggleBorderCameras, showBorderCameras]);

  const handleFullscreenToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFullscreen((prev) => !prev);
  }, []);

  /* Escape to close fullscreen */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── "Use as Start" handler ── */
  const [settingGeoStart, setSettingGeoStart] = useState(false);
  const handleUseAsStart = useCallback(async () => {
    if (!geoPosition || settingGeoStart) return;
    setSettingGeoStart(true);
    try {
      const label = await reverseGeocode(geoPosition.lat, geoPosition.lon);
      onSelectStart(label, { lat: geoPosition.lat, lon: geoPosition.lon });
    } finally {
      setSettingGeoStart(false);
    }
  }, [geoPosition, onSelectStart, settingGeoStart]);

  /* ─── Map content (shared between normal & fullscreen) ─── */
  const mapContent = (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <MapResizeHandler trigger={isFullscreen} />
      <DynamicTileLayer isDark={isDark} />

      {/* Fit to route when route data arrives */}
      {hasRoute && <FitBounds bounds={routeBounds} />}

      {/* Pan to geolocation in input mode (before route) */}
      {!hasRoute && <PanToGeo position={geoPosition ?? null} />}

      {/* Click handler for A/B picking */}
      <MapClickHandler pickMode={pickMode} onPick={handlePick} setPickMode={setPickMode} />

      {/* ── Geolocation blue dot ── */}
      {geoPosition && (
        <Marker position={[geoPosition.lat, geoPosition.lon]} icon={geoIcon} />
      )}

      {/* ── A/B markers ── */}
      {startPoint && <Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon} />}
      {endPoint && <Marker position={[endPoint.lat, endPoint.lon]} icon={destIcon} />}

      {/* ── Route polyline ── */}
      {hasRoute && (
        <Polyline positions={routePositions} pathOptions={{ color: "#1d4ed8", weight: 4 }} />
      )}

      {/* ── Highlighted country segments ── */}
      {highlightedCountryCode &&
        highlightedPositions.map((segment, index) => (
          <Polyline
            key={`${highlightedCountryCode}-${index}`}
            positions={segment}
            pathOptions={{ color: "#f97316", weight: 6, opacity: 0.9 }}
          />
        ))}

      {/* ── Plain border markers ── */}
      {plainBorderCrossings.map((crossing, idx) => (
        <Marker
          key={`crossing-${idx}`}
          position={[crossing.lat, crossing.lon]}
          icon={createBorderIcon(crossing.countryCodeFrom, crossing.countryCodeTo)}
        >
          <Popup>
            <div className="min-w-[160px] text-center text-sm font-medium text-zinc-900">
              {getFlag(crossing.countryCodeFrom)} {getCountryName(crossing.countryCodeFrom)} →{" "}
              {getFlag(crossing.countryCodeTo)} {getCountryName(crossing.countryCodeTo)}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* ── Camera pins (all border cameras when toggle is on) ── */}
      {showBorderCameras &&
        allCameraFeeds.map((cam, idx) => (
          <Marker
            key={`camera-${cam.countryCodeFrom}-${cam.countryCodeTo}-${cam.label}-${idx}`}
            position={[cam.lat, cam.lon]}
            icon={cameraIcon}
          >
            <Popup className="border-camera-popup">
              <div className="min-w-[220px] max-w-[280px] text-center">
                <p className="text-base font-bold text-zinc-900">
                  {getFlag(cam.countryCodeFrom)} {getCountryName(cam.countryCodeFrom)} ↔{" "}
                  {getFlag(cam.countryCodeTo)} {getCountryName(cam.countryCodeTo)}
                </p>
                <a
                  href={cam.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`View live camera at ${cam.label} border crossing`}
                  className="mt-3 block rounded-lg bg-sky-700 px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  🎥 {cam.label}
                  <span aria-hidden className="ml-1">↗</span>
                </a>
                <p className="mt-2 text-xs text-zinc-500">{t("map.cameraFeedHint")}</p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );

  /* ─── Wrapper class ─── */
  const wrapperClassName = isFullscreen
    ? "map-fullscreen fixed inset-0 z-[99999] flex flex-col bg-zinc-100"
    : "unified-map-container relative h-[50vh] min-h-[280px] max-h-[420px] lg:h-[480px] lg:max-h-none overflow-hidden rounded-2xl border border-zinc-200";

  /* ─── Rendered tree ─── */
  const mapWrapper = (
    <div className={wrapperClassName}>
      {/* Fullscreen header */}
      {isFullscreen && (
        <div className="map-fullscreen-header flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-zinc-700">{t("map.routeMap")}</span>
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="flex items-center gap-2 rounded-lg border-2 border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-400"
            aria-label={t("map.minimize")}
            title={`${t("map.minimize")} (Esc)`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
            {t("map.minimize")}
          </button>
        </div>
      )}

      {/* Map area */}
      <div className={`relative ${isFullscreen ? "min-h-0 flex-1" : "h-full"}`}>
        {mapContent}
      </div>

      {/* ── Floating overlay buttons ── */}

      {/* Pick A/B buttons (top-left) */}
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickMode((m) => (m === "start" ? null : "start"))}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium shadow-md transition-colors ${
            pickMode === "start"
              ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2"
              : "bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {pickMode === "start" ? t("mapPicker.setStartActive") : t("mapPicker.setStart")}
        </button>
        <button
          type="button"
          onClick={() => setPickMode((m) => (m === "end" ? null : "end"))}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium shadow-md transition-colors ${
            pickMode === "end"
              ? "bg-red-600 text-white ring-2 ring-red-400 ring-offset-2"
              : "bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {pickMode === "end" ? t("mapPicker.setDestActive") : t("mapPicker.setDest")}
        </button>
      </div>

      {/* "Use as Start" button – only when geolocation is available and no start is set yet */}
      {geoPosition && !startPoint && !geoLoading && (
        <button
          type="button"
          onClick={handleUseAsStart}
          disabled={settingGeoStart}
          className="absolute bottom-4 left-1/2 z-[1000] flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {settingGeoStart ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
          {t("map.useAsStart")}
        </button>
      )}

      {/* Fullscreen expand button (top-right) */}
      {!isFullscreen && (
        <button
          type="button"
          onClick={handleFullscreenToggle}
          aria-label="Expand map to fullscreen"
          title="Expand map (fullscreen)"
          className="map-overlay-btn pointer-events-auto"
          style={{ position: "absolute", top: 10, right: 10 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      )}

      {/* Camera toggle button (top-right, below fullscreen) */}
      {hasBorderCameraData && onToggleBorderCameras && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCameraToggle();
          }}
          aria-label={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
          aria-pressed={showBorderCameras}
          title={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
          className={`map-overlay-btn pointer-events-auto ${showBorderCameras ? "map-overlay-btn--active" : ""}`}
          style={{
            position: "absolute",
            top: isFullscreen ? 56 : 56,
            right: 10,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">📷</span>
          <span className="sr-only">{showBorderCameras ? "Hide border cameras" : "Show border cameras"}</span>
        </button>
      )}
    </div>
  );

  /* Portal for fullscreen mode */
  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(mapWrapper, document.body);
  }
  return mapWrapper;
});
