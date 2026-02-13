"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds } from "leaflet";
import { useMemo } from "react";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import type { CountryCode, RouteLineString } from "@/types/vignette";

interface MapClientProps {
  coordinates: [number, number][];
  highlightedCountryCode?: CountryCode | null;
  highlightedSegments?: RouteLineString[];
}

export function MapClient({ coordinates, highlightedCountryCode, highlightedSegments = [] }: MapClientProps) {
  const positions = useMemo(() => coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), [coordinates]);
  const bounds = useMemo(() => new LatLngBounds(positions), [positions]);
  const highlightedPositions = useMemo(
    () => highlightedSegments.map((segment) => segment.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
    [highlightedSegments],
  );

  if (!positions.length) {
    return null;
  }

  return (
    <div className="h-[360px] overflow-hidden rounded-2xl border border-zinc-200">
      <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
        <Polyline positions={positions} pathOptions={{ color: "#1d4ed8", weight: 4 }} />
        {highlightedCountryCode
          ? highlightedPositions.map((segment, index) => (
              <Polyline key={`${highlightedCountryCode}-${index}`} positions={segment} pathOptions={{ color: "#f97316", weight: 6, opacity: 0.9 }} />
            ))
          : null}
      </MapContainer>
    </div>
  );
}
