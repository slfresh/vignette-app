"use client";

import { TileLayer } from "react-leaflet";

export function MapTrafficLayer({
  showTraffic,
  trafficTileUrl,
  trafficIncidentTileUrl,
}: {
  showTraffic: boolean;
  trafficTileUrl: string | null;
  trafficIncidentTileUrl: string | null;
}) {
  if (!showTraffic) return null;

  return (
    <>
      {trafficTileUrl && (
        <TileLayer
          url={trafficTileUrl}
          opacity={0.8}
          zIndex={10}
        />
      )}
      {trafficIncidentTileUrl && (
        <TileLayer
          url={trafficIncidentTileUrl}
          opacity={0.8}
          zIndex={11}
        />
      )}
    </>
  );
}
