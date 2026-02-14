"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import L from "leaflet";
import { LatLngBounds } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import type { CountryCode, RouteLineString } from "@/types/vignette";
import { getCameraPinsForCrossings, type CameraFeedWithDistance } from "@/lib/border/cameraPins";

/** Tile layer config for light and dark themes. */
const TILE_LIGHT = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
};
const TILE_DARK = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/**
 * Detects whether the app is in dark mode by checking the html.theme-dark class.
 * Re-renders when the theme changes via a MutationObserver on <html>.
 */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("theme-dark"));

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("theme-dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Imperatively manages the tile layer on the Leaflet map.
 * react-leaflet's MapContainer is immutable after creation, so we use
 * the Leaflet API directly to swap tile layers when the theme changes.
 */
/** Notifies Leaflet to recalculate tile/view when container size changes (e.g. fullscreen toggle). */
function MapResizeHandler({ fullscreenActive }: { fullscreenActive: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(t);
  }, [fullscreenActive, map]);
  return null;
}

function DynamicTileLayer({ isDark }: { isDark: boolean }) {
  const map = useMap();

  useEffect(() => {
    const config = isDark ? TILE_DARK : TILE_LIGHT;
    const layer = L.tileLayer(config.url, { attribution: config.attribution });
    layer.addTo(map);

    // Remove the old layer on cleanup (when isDark changes or component unmounts)
    return () => {
      map.removeLayer(layer);
    };
  }, [isDark, map]);

  return null;
}

interface MapClientProps {
  coordinates: [number, number][];
  highlightedCountryCode?: CountryCode | null;
  highlightedSegments?: RouteLineString[];
  borderCrossings?: Array<{
    countryCodeFrom: CountryCode;
    countryCodeTo: CountryCode;
    lat: number;
    lon: number;
  }>;
  showBorderCameras?: boolean;
  /** Callback when the user toggles cameras from the map overlay button */
  onToggleBorderCameras?: (next: boolean) => void;
  /** Whether border crossings with cameras exist (to show the toggle) */
  hasBorderCameraData?: boolean;
}

/** Camera icon SVG for border crossing pins (opens external live feed). */
const cameraIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;

const cameraIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:#e0f2fe;border:2px solid #0ea5e9;box-shadow:0 2px 4px rgba(0,0,0,0.2)">${cameraIconSvg}</div>`,
  className: "border-camera-pin",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

/**
 * Creates a flag-pair icon for plain border crossings (no camera available).
 * Shows both country flags side by side in a small pill shape.
 */
function createBorderIcon(codeFrom: string, codeTo: string): L.DivIcon {
  const flagFrom = FLAG_EMOJI[codeFrom] ?? "🏳️";
  const flagTo = FLAG_EMOJI[codeTo] ?? "🏳️";
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;gap:1px;width:44px;height:26px;border-radius:13px;background:#fff;border:2px solid #a1a1aa;box-shadow:0 2px 4px rgba(0,0,0,0.15);font-size:13px;line-height:1">${flagFrom}${flagTo}</div>`,
    className: "border-crossing-pin",
    iconSize: [44, 26],
    iconAnchor: [22, 13],
    popupAnchor: [0, -13],
  });
}

const FLAG_EMOJI: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CZ: "🇨🇿", SK: "🇸🇰", HU: "🇭🇺", SI: "🇸🇮", CH: "🇨🇭", RO: "🇷🇴",
  BG: "🇧🇬", HR: "🇭🇷", RS: "🇷🇸", DK: "🇩🇰", SE: "🇸🇪", NL: "🇳🇱", BE: "🇧🇪", FR: "🇫🇷",
  IT: "🇮🇹", BA: "🇧🇦", ME: "🇲🇪", XK: "🇽🇰", MK: "🇲🇰", AL: "🇦🇱", PL: "🇵🇱", ES: "🇪🇸",
  PT: "🇵🇹", GB: "🇬🇧", IE: "🇮🇪", TR: "🇹🇷", GR: "🇬🇷",
};

/** Short country names for popup titles – more readable than just the code. */
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

export function MapClient({
  coordinates,
  highlightedCountryCode,
  highlightedSegments = [],
  borderCrossings = [],
  showBorderCameras = false,
  onToggleBorderCameras,
  hasBorderCameraData = false,
}: MapClientProps) {
  const isDark = useIsDarkMode();

  const positions = useMemo(() => coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), [coordinates]);
  const bounds = useMemo(() => new LatLngBounds(positions), [positions]);
  const highlightedPositions = useMemo(
    () => highlightedSegments.map((segment) => segment.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
    [highlightedSegments],
  );

  const { cameraPins, plainCrossings } = useMemo(() => {
    if (!borderCrossings.length) {
      return { cameraPins: [], plainCrossings: [] };
    }
    const pins = getCameraPinsForCrossings(borderCrossings);
    const pinKeys = new Set(pins.map((p) => `${p.lat},${p.lon}`));
    const plain = borderCrossings.filter((c) => !pinKeys.has(`${c.lat},${c.lon}`));
    return { cameraPins: pins, plainCrossings: plain };
  }, [borderCrossings]);

  /* When camera toggle is off: show plain markers for all. When on: camera markers for pins, plain for the rest. */
  const plainToShow = showBorderCameras ? plainCrossings : borderCrossings;

  const handleCameraToggle = useCallback(() => {
    onToggleBorderCameras?.(!showBorderCameras);
  }, [onToggleBorderCameras, showBorderCameras]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleFullscreenToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFullscreen((prev) => !prev);
  }, []);

  if (!positions.length) {
    return null;
  }

  const mapContent = (
    <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full">
      <MapResizeHandler fullscreenActive={isFullscreen} />
      <DynamicTileLayer isDark={isDark} />
        <Polyline positions={positions} pathOptions={{ color: "#1d4ed8", weight: 4 }} />
        {highlightedCountryCode
          ? highlightedPositions.map((segment, index) => (
              <Polyline key={`${highlightedCountryCode}-${index}`} positions={segment} pathOptions={{ color: "#f97316", weight: 6, opacity: 0.9 }} />
            ))
          : null}

        {/* Plain border markers (all when toggle off; only crossings without cameras when on) */}
        {plainToShow.map((crossing, idx) => (
          <Marker
            key={`crossing-${idx}`}
            position={[crossing.lat, crossing.lon]}
            icon={createBorderIcon(crossing.countryCodeFrom, crossing.countryCodeTo)}
          >
            <Popup>
              <div className="min-w-[160px] text-center text-sm font-medium text-zinc-900">
                {getFlag(crossing.countryCodeFrom)} {getCountryName(crossing.countryCodeFrom)} → {getFlag(crossing.countryCodeTo)} {getCountryName(crossing.countryCodeTo)}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Camera pins with rich popup (when toggle is on) */}
        {showBorderCameras &&
          cameraPins.map((pin, idx) => (
            <Marker key={`camera-${pin.countryCodeFrom}-${pin.countryCodeTo}-${idx}`} position={[pin.lat, pin.lon]} icon={cameraIcon}>
                <Popup className="border-camera-popup">
                  <div className="min-w-[260px] max-w-[320px] text-center">
                    {/* Title with full country names */}
                    <p className="text-base font-bold text-zinc-900">
                      {getFlag(pin.countryCodeFrom)} {getCountryName(pin.countryCodeFrom)} ↔ {getFlag(pin.countryCodeTo)} {getCountryName(pin.countryCodeTo)}
                    </p>

                    {/* Camera buttons with distance badges */}
                    <div className="mt-3 space-y-2.5">
                      {pin.cameras.map((cam: CameraFeedWithDistance, i: number) => {
                        const isOnRoute = i === 0;
                        return (
                          <div key={i} className="text-left">
                            <a
                              href={cam.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="block rounded-lg px-3 py-2.5 text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: isOnRoute ? "#0369a1" : "#475569" }}
                            >
                              {/* Camera name on its own line */}
                              <span className="block text-sm font-semibold leading-snug">
                                🎥 {cam.label}
                                <span aria-hidden className="ml-1">↗</span>
                              </span>
                            </a>
                            {/* Badge below the button for better readability */}
                            <div className="mt-1 flex items-center gap-1.5 px-1">
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: isOnRoute ? "#e0f2fe" : "#f4f4f5",
                                  color: isOnRoute ? "#0c4a6e" : "#52525b",
                                }}
                              >
                                {isOnRoute ? "On your route" : "Nearby alternative"}
                              </span>
                              {cam.distanceKm > 0 && (
                                <span className="text-xs text-zinc-500">
                                  ~{cam.distanceKm} km away
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-2.5 text-xs text-zinc-500">Opens external site in new tab</p>
                  </div>
                </Popup>
            </Marker>
          ))}
    </MapContainer>
  );

  const mapWrapperClassName = isFullscreen
    ? "map-fullscreen fixed inset-0 z-[99999] flex flex-col bg-zinc-100"
    : "relative h-[480px] overflow-hidden rounded-2xl border border-zinc-200";

  const mapWrapper = (
    <div className={mapWrapperClassName}>
        {isFullscreen && (
          <div className="map-fullscreen-header flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-sm font-medium text-zinc-700">Route map</span>
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="flex items-center gap-2 rounded-lg border-2 border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-400"
              aria-label="Minimize map"
              title="Minimize map (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
              Minimize
            </button>
          </div>
        )}
        <div className={`relative ${isFullscreen ? "min-h-0 flex-1" : "h-full"}`}>
          {mapContent}
        </div>

        {/* Fullscreen expand button (top-right) */}
        {!isFullscreen && (
          <button
            type="button"
            onClick={handleFullscreenToggle}
            aria-label="Expand map to fullscreen"
            title="Expand map (fullscreen)"
            className="pointer-events-auto"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 1001,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 6,
              border: "2px solid #94a3b8",
              background: "#ffffff",
              color: "#1e293b",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              cursor: "pointer",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        )}

        {/* On-map camera toggle button (top-right, below fullscreen & zoom controls) */}
        {hasBorderCameraData && onToggleBorderCameras && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCameraToggle();
            }}
            aria-label={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
            title={showBorderCameras ? "Hide border cameras" : "Show border cameras"}
            className="pointer-events-auto"
            style={{
              position: "absolute",
              top: isFullscreen ? 56 : 52,
              right: 10,
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            minWidth: 36,
            minHeight: 36,
            borderRadius: 6,
            border: `2px solid ${showBorderCameras ? "#0ea5e9" : "#94a3b8"}`,
            background: showBorderCameras ? "#e0f2fe" : "#ffffff",
            color: "#1e293b",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          📷
        </button>
        )}
      </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(mapWrapper, document.body);
  }
  return mapWrapper;
}
