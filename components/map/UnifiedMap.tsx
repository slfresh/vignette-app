"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import L from "leaflet";
import { LatLngBounds } from "leaflet";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { CountryCode, RouteLineString, RoutePoint } from "@/types/vignette";
import { getAllCameraFeeds } from "@/lib/border/cameraPins";
import { getAllHighwayCameras, type HighwayCamera } from "@/lib/cameras/highwayCameras";
import type { SpeedCamera } from "@/lib/cameras/speedCameras";
import { useI18n } from "@/components/i18n/I18nProvider";

/* ─── Tile configuration ─── */
const TILE_LIGHT = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};
const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/* ─── Default center (Europe) ─── */
const DEFAULT_CENTER: [number, number] = [48.5, 13.5];
const DEFAULT_ZOOM = 5;

/* ─── Map bounds (prevent panning into duplicate worlds) ─── */
const MAX_BOUNDS: L.LatLngBoundsExpression = [
  [-85, -180],
  [85, 180],
];

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

/** Speed camera (radar) icon — red triangle with exclamation */
const radarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const radarIcon = L.divIcon({
  html: `<div class="radar-icon-circle">${radarIconSvg}</div>`,
  className: "speed-camera-pin",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

/** Highway camera icon — road/film SVG in orange */
const highwayCamSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;

const highwayCamIcon = L.divIcon({
  html: `<div class="highway-cam-icon-circle">${highwayCamSvg}</div>`,
  className: "highway-camera-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
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
    const layer = L.tileLayer(config.url, { attribution: config.attribution, noWrap: true });
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

/** Fits the map to route bounds when coordinates change.
 *  Retries once after a short delay to handle cases where
 *  the map container hasn't finished its initial layout yet. */
function FitBounds({ bounds }: { bounds: LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;

    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    };

    fit();
    const retryId = setTimeout(fit, 300);
    return () => clearTimeout(retryId);
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

/** Small purple dot shown at the clicked location while the context popup is open. */
const contextPinIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#6366f1;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: "context-pin",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

/**
 * Google Maps-style context popup: click anywhere on the map to see an address
 * and choose "Directions from here" or "Directions to here".
 */
function MapContextPopup({
  onSelectStart,
  onSelectDestination,
}: {
  onSelectStart: (label: string, point: RoutePoint) => void;
  onSelectDestination: (label: string, point: RoutePoint) => void;
}) {
  const { t } = useI18n();
  const markerRef = useRef<L.Marker>(null);
  const [clicked, setClicked] = useState<{
    latlng: L.LatLng;
    label: string | null;
  } | null>(null);

  useMapEvents({
    click: async (e: L.LeafletMouseEvent) => {
      const wrapped = e.latlng.wrap();
      setClicked({ latlng: wrapped, label: null });
      try {
        const label = await reverseGeocode(wrapped.lat, wrapped.lng);
        setClicked((prev) =>
          prev && prev.latlng.equals(wrapped) ? { ...prev, label } : prev,
        );
      } catch {
        const fallback = `${wrapped.lat.toFixed(4)}, ${wrapped.lng.toFixed(4)}`;
        setClicked((prev) =>
          prev && prev.latlng.equals(wrapped) ? { ...prev, label: fallback } : prev,
        );
      }
    },
  });

  useEffect(() => {
    if (clicked && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [clicked]);

  if (!clicked) return null;

  const point: RoutePoint = { lat: clicked.latlng.lat, lon: clicked.latlng.lng };
  const resolvedLabel =
    clicked.label ?? `${clicked.latlng.lat.toFixed(4)}, ${clicked.latlng.lng.toFixed(4)}`;

  const handleFrom = () => {
    onSelectStart(resolvedLabel, point);
    setClicked(null);
  };
  const handleTo = () => {
    onSelectDestination(resolvedLabel, point);
    setClicked(null);
  };

  return (
    <Marker ref={markerRef} position={clicked.latlng} icon={contextPinIcon}>
      <Popup
        eventHandlers={{ remove: () => setClicked(null) }}
      >
        <div className="context-popup min-w-[210px] text-center">
          {clicked.label === null ? (
            <p className="flex items-center justify-center gap-2 py-1 text-sm text-zinc-500">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              {t("map.loadingAddress")}
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-zinc-900">
                {clicked.label}
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleFrom}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <span style={{ fontSize: "16px" }}>A</span>
                  {t("map.directionsFrom")}
                </button>
                <button
                  type="button"
                  onClick={handleTo}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ef4444] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <span style={{ fontSize: "16px" }}>B</span>
                  {t("map.directionsTo")}
                </button>
              </div>
            </>
          )}
        </div>
      </Popup>
    </Marker>
  );
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

  /* ── Speed cameras (Lufop API) ── */
  speedCameras?: SpeedCamera[];
  showSpeedCameras?: boolean;
  onToggleSpeedCameras?: (next: boolean) => void;
  speedCamerasAvailable?: boolean;

  /* ── Highway cameras (HAK) ── */
  showHighwayCameras?: boolean;
  onToggleHighwayCameras?: (next: boolean) => void;

  /* ── Traffic layer (TomTom) ── */
  showTraffic?: boolean;
  onToggleTraffic?: (next: boolean) => void;
  trafficTileUrl?: string | null;

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
  speedCameras = [],
  showSpeedCameras = false,
  onToggleSpeedCameras,
  speedCamerasAvailable = false,
  showHighwayCameras = false,
  onToggleHighwayCameras,
  showTraffic = false,
  onToggleTraffic,
  trafficTileUrl = null,
  geoPosition,
  geoLoading = false,
}: UnifiedMapProps) {
  const { t } = useI18n();
  const isDark = useIsDarkMode();

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
  const handleCameraToggle = useCallback(() => {
    onToggleBorderCameras?.(!showBorderCameras);
  }, [onToggleBorderCameras, showBorderCameras]);

  const handleSpeedCameraToggle = useCallback(() => {
    onToggleSpeedCameras?.(!showSpeedCameras);
  }, [onToggleSpeedCameras, showSpeedCameras]);

  /* ── Highway cameras (static data) ── */
  const allHighwayCameras: HighwayCamera[] = useMemo(() => getAllHighwayCameras(), []);

  const handleHighwayCameraToggle = useCallback(() => {
    onToggleHighwayCameras?.(!showHighwayCameras);
  }, [onToggleHighwayCameras, showHighwayCameras]);

  const handleTrafficToggle = useCallback(() => {
    onToggleTraffic?.(!showTraffic);
  }, [onToggleTraffic, showTraffic]);

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
      minZoom={4}
      scrollWheelZoom
      maxBounds={MAX_BOUNDS}
      maxBoundsViscosity={1.0}
      worldCopyJump={false}
      className="h-full w-full"
    >
      <MapResizeHandler trigger={isFullscreen} />
      <DynamicTileLayer isDark={isDark} />

      {/* Traffic flow overlay (TomTom) */}
      {showTraffic && trafficTileUrl && (
        <TileLayer
          url={trafficTileUrl}
          opacity={0.7}
          zIndex={10}
        />
      )}

      {/* Fit to route when route data arrives */}
      {hasRoute && <FitBounds bounds={routeBounds} />}

      {/* Pan to geolocation in input mode (before route) */}
      {!hasRoute && <PanToGeo position={geoPosition ?? null} />}

      {/* Google Maps-style context popup for A/B picking */}
      <MapContextPopup onSelectStart={onSelectStart} onSelectDestination={onSelectDestination} />

      {/* ── Geolocation blue dot ── */}
      {geoPosition && (
        <Marker position={[geoPosition.lat, geoPosition.lon]} icon={geoIcon} />
      )}

      {/* ── A/B markers ── */}
      {startPoint && <Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon} />}
      {endPoint && <Marker position={[endPoint.lat, endPoint.lon]} icon={destIcon} />}

      {/* ── Route polyline ── */}
      {hasRoute && (
        <>
          <Polyline positions={routePositions} pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.4 }} />
          <Polyline positions={routePositions} pathOptions={{ color: isDark ? "#60a5fa" : "#2563eb", weight: 5, opacity: 0.9 }} />
        </>
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

      {/* ── Camera pins with clustering ── */}
      {showBorderCameras && (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={40} disableClusteringAtZoom={10}>
          {allCameraFeeds.map((cam, idx) => (
            <Marker
              key={`camera-${cam.countryCodeFrom}-${cam.countryCodeTo}-${cam.label}-${idx}`}
              position={[cam.lat, cam.lon]}
              icon={cameraIcon}
            >
              <Popup>
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
        </MarkerClusterGroup>
      )}

      {/* ── Speed camera pins with clustering ── */}
      {showSpeedCameras && speedCameras.length > 0 && (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={35} disableClusteringAtZoom={12}>
          {speedCameras.map((cam) => (
            <Marker
              key={`radar-${cam.id}`}
              position={[cam.lat, cam.lon]}
              icon={radarIcon}
            >
              <Popup>
                <div className="min-w-[180px] max-w-[260px] text-center">
                  <p className="text-sm font-bold text-red-700">
                    {t("map.speedCameraPopup")}
                  </p>
                  {cam.speedLimit && (
                    <p className="mt-1 text-lg font-bold text-zinc-900">
                      {t("map.speedLimit")}: {cam.speedLimit} km/h
                    </p>
                  )}
                  {cam.road && (
                    <p className="mt-1 text-xs text-zinc-600">{cam.road}</p>
                  )}
                  {cam.city && (
                    <p className="text-xs text-zinc-500">{cam.city}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}

      {/* ── Highway camera pins with clustering ── */}
      {showHighwayCameras && (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={35} disableClusteringAtZoom={9}>
          {allHighwayCameras.map((cam) => (
            <Marker
              key={`hwy-${cam.id}`}
              position={[cam.lat, cam.lon]}
              icon={highwayCamIcon}
            >
              <Popup>
                <div className="min-w-[200px] max-w-[260px] text-center">
                  <p className="text-sm font-bold text-amber-700">
                    {cam.highway} — {cam.label}
                  </p>
                  <a
                    href={cam.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`View highway camera at ${cam.label}`}
                    className="mt-2 block rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    🎥 {cam.label}
                    <span aria-hidden className="ml-1">↗</span>
                  </a>
                  <p className="mt-2 text-xs text-zinc-500">{t("map.highwayCameraHint")}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}
    </MapContainer>
  );

  /* ─── Wrapper class ─── */
  const wrapperClassName = isFullscreen
    ? "map-fullscreen fixed inset-0 z-[99999] flex flex-col bg-background"
    : "unified-map-container relative h-full w-full overflow-hidden";

  /* ─── Rendered tree ─── */
  const mapWrapper = (
    <div className={wrapperClassName}>
      {/* Fullscreen header */}
      {isFullscreen && (
        <div className="map-fullscreen-header flex items-center justify-between border-b border-[var(--border)] bg-surface px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-[var(--text-primary)]">{t("map.routeMap")}</span>
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-surface px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] shadow-sm hover:bg-surface-muted"
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

      {/* "Use as Start" button – only when geolocation is available and no start is set yet */}
      {geoPosition && !startPoint && !geoLoading && (
        <button
          type="button"
          onClick={handleUseAsStart}
          disabled={settingGeoStart}
          className="absolute bottom-4 left-1/2 z-[1000] flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
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

      {/* ── Right-side overlay controls (flex column, auto-flows) ── */}
      <div className="absolute right-2.5 top-2.5 z-[1000] flex flex-col gap-2">
        {/* Fullscreen expand */}
        {!isFullscreen && (
          <button
            type="button"
            onClick={handleFullscreenToggle}
            aria-label="Expand map to fullscreen"
            title="Expand map (fullscreen)"
            className="map-overlay-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        )}

        {/* Border cameras */}
        {hasBorderCameraData && onToggleBorderCameras && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCameraToggle(); }}
            aria-label={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
            aria-pressed={showBorderCameras}
            title={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
            className={`map-overlay-btn text-lg leading-none ${showBorderCameras ? "map-overlay-btn--active" : ""}`}
          >
            <span aria-hidden="true">📷</span>
          </button>
        )}

        {/* Speed cameras */}
        {speedCamerasAvailable && onToggleSpeedCameras && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSpeedCameraToggle(); }}
            aria-label={showSpeedCameras ? t("map.hideSpeedCameras") : t("map.showSpeedCameras")}
            aria-pressed={showSpeedCameras}
            title={showSpeedCameras ? t("map.hideSpeedCameras") : t("map.showSpeedCameras")}
            className={`map-overlay-btn text-base leading-none ${showSpeedCameras ? "map-overlay-btn--active" : ""}`}
          >
            <span aria-hidden="true">🚨</span>
          </button>
        )}

        {/* Highway cameras */}
        {onToggleHighwayCameras && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleHighwayCameraToggle(); }}
            aria-label={showHighwayCameras ? t("map.hideHighwayCameras") : t("map.showHighwayCameras")}
            aria-pressed={showHighwayCameras}
            title={showHighwayCameras ? t("map.hideHighwayCameras") : t("map.showHighwayCameras")}
            className={`map-overlay-btn text-base leading-none ${showHighwayCameras ? "map-overlay-btn--active" : ""}`}
          >
            <span aria-hidden="true">🛣️</span>
          </button>
        )}

        {/* Traffic layer */}
        {onToggleTraffic && trafficTileUrl && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrafficToggle(); }}
            aria-label={showTraffic ? t("map.hideTraffic") : t("map.showTraffic")}
            aria-pressed={showTraffic}
            title={showTraffic ? t("map.hideTraffic") : t("map.showTraffic")}
            className={`map-overlay-btn text-base leading-none ${showTraffic ? "map-overlay-btn--active" : ""}`}
          >
            <span aria-hidden="true">🚦</span>
          </button>
        )}
      </div>

      {/* Lufop attribution (when speed cameras shown) */}
      {showSpeedCameras && speedCameras.length > 0 && (
        <div className="absolute bottom-1 left-1 z-[1000] rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-zinc-500">
          <a href="https://lufop.net" target="_blank" rel="noreferrer noopener" className="hover:underline">
            {t("map.lufopAttribution")}
          </a>
        </div>
      )}
    </div>
  );

  /* Portal for fullscreen mode */
  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(mapWrapper, document.body);
  }
  return mapWrapper;
});
