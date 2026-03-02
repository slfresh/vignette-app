"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Manages all map overlay toggles, camera data, and traffic tile state.
 * Extracts ~10 useState calls from the main page component.
 */
export function useMapOverlays(result: RouteAnalysisResult | null): MapOverlays {
  const [showBorderCameras, setShowBorderCameras] = useState(false);
  const [showSpeedCameras, setShowSpeedCameras] = useState(false);
  const [showHighwayCameras, setShowHighwayCameras] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficTileUrl, setTrafficTileUrl] = useState<string | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [speedCameras, setSpeedCameras] = useState<SpeedCameraData[]>([]);
  const [speedCamerasAvailable, setSpeedCamerasAvailable] = useState(false);

  // Fetch speed cameras when route is available and user toggles them on
  useEffect(() => {
    if (!showSpeedCameras || !result?.routeGeoJson?.coordinates) return;
    if (speedCameras.length > 0) return;

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
        // Speed cameras are a non-critical feature
      }
    }
    loadSpeedCameras();
    return () => { cancelled = true; };
  }, [showSpeedCameras, result, speedCameras.length]);

  // Check speed camera API availability on mount
  useEffect(() => {
    let cancelled = false;
    async function checkAvailability() {
      try {
        const response = await fetch("/api/speed-cameras?lat=48&lon=13&radius=1");
        const data = await response.json();
        if (!cancelled) {
          setSpeedCamerasAvailable(data.available === true);
        }
      } catch {
        // Silently disabled
      }
    }
    checkAvailability();
    return () => { cancelled = true; };
  }, []);

  // Check traffic API availability and get tile URLs
  useEffect(() => {
    let cancelled = false;
    async function checkTraffic() {
      try {
        const response = await fetch("/api/traffic?lat=48&lon=13&radius=1");
        const data = await response.json();
        if (!cancelled && data.available && data.tileUrls?.flow) {
          setTrafficTileUrl(data.tileUrls.flow);
        }
      } catch {
        // Silently disabled
      }
    }
    checkTraffic();
    return () => { cancelled = true; };
  }, []);

  // Reset border cameras when a new route is calculated
  const setShowBorderCamerasWrapped = useCallback((v: boolean) => {
    setShowBorderCameras(v);
  }, []);

  return {
    showBorderCameras,
    showSpeedCameras,
    showHighwayCameras,
    showTraffic,
    trafficTileUrl,
    speedCameras,
    speedCamerasAvailable,
    showAiChat,
    setShowBorderCameras: setShowBorderCamerasWrapped,
    setShowSpeedCameras,
    setShowHighwayCameras,
    setShowTraffic,
    setShowAiChat,
  };
}
