"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import L from "leaflet";
import { LatLngBounds } from "leaflet";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import type { CountryCode, RouteLineString, RoutePoint } from "@/types/vignette";
import type { SpeedCamera } from "@/lib/cameras/speedCameras";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MapCameraMarkers } from "@/components/map/MapCameraMarkers";
import { MapContextPopup, reverseGeocode } from "@/components/map/MapContextPopup";
import { MapTrafficLayer } from "@/components/map/MapTrafficLayer";
import { destIcon, geoIcon, startIcon } from "@/components/map/mapIcons";

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
  trafficIncidentTileUrl?: string | null;

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
  trafficIncidentTileUrl = null,
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

  /* ── Handlers ── */
  const handleCameraToggle = useCallback(() => {
    onToggleBorderCameras?.(!showBorderCameras);
  }, [onToggleBorderCameras, showBorderCameras]);

  const handleSpeedCameraToggle = useCallback(() => {
    onToggleSpeedCameras?.(!showSpeedCameras);
  }, [onToggleSpeedCameras, showSpeedCameras]);

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

      <MapTrafficLayer
        showTraffic={showTraffic}
        trafficTileUrl={trafficTileUrl}
        trafficIncidentTileUrl={trafficIncidentTileUrl}
      />

      {hasRoute && <FitBounds bounds={routeBounds} />}
      {!hasRoute && <PanToGeo position={geoPosition ?? null} />}

      <MapContextPopup onSelectStart={onSelectStart} onSelectDestination={onSelectDestination} />

      {geoPosition && (
        <Marker position={[geoPosition.lat, geoPosition.lon]} icon={geoIcon} />
      )}

      {startPoint && <Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon} />}
      {endPoint && <Marker position={[endPoint.lat, endPoint.lon]} icon={destIcon} />}

      {hasRoute && (
        <>
          <Polyline positions={routePositions} pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.4 }} />
          <Polyline positions={routePositions} pathOptions={{ color: isDark ? "#60a5fa" : "#2563eb", weight: 5, opacity: 0.9 }} />
        </>
      )}

      {highlightedCountryCode &&
        highlightedPositions.map((segment, index) => (
          <Polyline
            key={`${highlightedCountryCode}-${index}`}
            positions={segment}
            pathOptions={{ color: "#f97316", weight: 6, opacity: 0.9 }}
          />
        ))}

      <MapCameraMarkers
        borderCrossings={borderCrossings}
        showBorderCameras={showBorderCameras}
        speedCameras={speedCameras}
        showSpeedCameras={showSpeedCameras}
        showHighwayCameras={showHighwayCameras}
      />
    </MapContainer>
  );

  /* ─── Wrapper class ─── */
  const wrapperClassName = isFullscreen
    ? "map-fullscreen fixed inset-0 z-[99999] flex flex-col bg-background"
    : "unified-map-container relative h-full w-full overflow-hidden";

  /* ─── Rendered tree ─── */
  const mapWrapper = (
    <div className={wrapperClassName}>
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

      <div className={`relative ${isFullscreen ? "min-h-0 flex-1" : "h-full"}`}>
        {mapContent}
      </div>

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

      <div className="absolute right-2.5 top-2.5 z-[1000] flex flex-col gap-2">
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

        {onToggleTraffic && (trafficTileUrl || trafficIncidentTileUrl) && (
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

      {showSpeedCameras && speedCameras.length > 0 && (
        <div className="absolute bottom-1 left-1 z-[1000] rounded bg-[var(--background)]/80 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
          <a href="https://lufop.net" target="_blank" rel="noreferrer noopener" className="hover:underline">
            {t("map.lufopAttribution")}
          </a>
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(mapWrapper, document.body);
  }
  return mapWrapper;
});
