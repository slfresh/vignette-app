"use client";

import { useCallback, useEffect, useState } from "react";
import { getTrafficFlowTileProxyUrl, getTrafficIncidentTileProxyUrl } from "@/lib/traffic/tomtom";
import type { RouteAnalysisResult } from "@/types/vignette";

interface SpeedCameraData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  city: string;
  road: string;
  flashDirection: "D" | "B" | "F";
  azimuth: number;
  speedLimit: number | null;
  updatedAt: string;
}

interface MapOverlayState {
  showBorderCameras: boolean;
  showSpeedCameras: boolean;
  showHighwayCameras: boolean;
  showTraffic: boolean;
  trafficTileUrl: string | null;
  trafficIncidentTileUrl: string | null;
  speedCameras: SpeedCameraData[];
  speedCamerasAvailable: boolean;
  showAiChat: boolean;
}

interface MapOverlayActions {
  setShowBorderCameras: (v: boolean) => void;
  setShowSpeedCameras: (v: boolean) => void;
  setShowHighwayCameras: (v: boolean) => void;
  setShowTraffic: (v: boolean) => void;
  setShowAiChat: React.Dispatch<React.SetStateAction<boolean>>;
}

export type MapOverlays = MapOverlayState & MapOverlayActions;

export function useMapOverlays(result: RouteAnalysisResult | null): MapOverlays {
  const [showBorderCameras, setShowBorderCameras] = useState(false);
  const [showSpeedCameras, setShowSpeedCameras] = useState(false);
  const [showHighwayCameras, setShowHighwayCameras] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficTileUrl, setTrafficTileUrl] = useState<string | null>(null);
  const [trafficIncidentTileUrl, setTrafficIncidentTileUrl] = useState<string | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [speedCameras, setSpeedCameras] = useState<SpeedCameraData[]>([]);
  const [speedCamerasAvailable, setSpeedCamerasAvailable] = useState(false);
  const [speedCamerasProbed, setSpeedCamerasProbed] = useState(false);

  useEffect(() => {
    if (!showSpeedCameras || !result?.routeGeoJson?.coordinates || speedCameras.length > 0) return;

    let cancelled = false;
    async function loadSpeedCameras() {
      try {
        const coords = result!.routeGeoJson.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        const [lon, lat] = coords[midIdx];
        const response = await fetch(`/api/speed-cameras?lat=${lat}&lon=${lon}&radius=150`);
        const data = await response.json();
        if (!cancelled && data.cameras) {
          setSpeedCameras(data.cameras);
          setSpeedCamerasAvailable(data.available !== false);
        }
      } catch {
        // non-critical
      }
    }
    loadSpeedCameras();
    return () => {
      cancelled = true;
    };
  }, [showSpeedCameras, result, speedCameras.length]);

  const probeSpeedCameras = useCallback(async () => {
    if (speedCamerasProbed) return;
    setSpeedCamerasProbed(true);
    try {
      const response = await fetch("/api/speed-cameras?lat=48&lon=13&radius=1");
      const data = await response.json();
      setSpeedCamerasAvailable(data.available === true);
    } catch {
      setSpeedCamerasAvailable(false);
    }
  }, [speedCamerasProbed]);

  const setShowSpeedCamerasWrapped = useCallback(
    (v: boolean) => {
      if (v) void probeSpeedCameras();
      setShowSpeedCameras(v);
    },
    [probeSpeedCameras],
  );

  const setShowTrafficWrapped = useCallback((v: boolean) => {
    if (v && !trafficTileUrl) {
      setTrafficTileUrl(getTrafficFlowTileProxyUrl("relative-delay"));
      setTrafficIncidentTileUrl(getTrafficIncidentTileProxyUrl());
    }
    setShowTraffic(v);
  }, [trafficTileUrl]);

  const setShowBorderCamerasWrapped = useCallback((v: boolean) => {
    setShowBorderCameras(v);
  }, []);

  return {
    showBorderCameras,
    showSpeedCameras,
    showHighwayCameras,
    showTraffic,
    trafficTileUrl,
    trafficIncidentTileUrl,
    speedCameras,
    speedCamerasAvailable,
    showAiChat,
    setShowBorderCameras: setShowBorderCamerasWrapped,
    setShowSpeedCameras: setShowSpeedCamerasWrapped,
    setShowHighwayCameras,
    setShowTraffic: setShowTrafficWrapped,
    setShowAiChat,
  };
}
