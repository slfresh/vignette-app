"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { LatLngBounds } from "leaflet";
import { useMemo } from "react";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";

interface MapClientProps {
  coordinates: [number, number][];
}

export function MapClient({ coordinates }: MapClientProps) {
  const positions = useMemo(() => coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), [coordinates]);
  const bounds = useMemo(() => new LatLngBounds(positions), [positions]);

  if (!positions.length) {
    return null;
  }

  return (
    <div className="h-[360px] overflow-hidden rounded-2xl border border-zinc-200">
      <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
        <Polyline positions={positions} pathOptions={{ color: "#1d4ed8", weight: 4 }} />
      </MapContainer>
    </div>
  );
}
