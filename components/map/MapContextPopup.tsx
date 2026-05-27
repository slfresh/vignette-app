"use client";

import type L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import type { RoutePoint } from "@/types/vignette";
import { useI18n } from "@/components/i18n/I18nProvider";
import { contextPinIcon } from "@/components/map/mapIcons";

/** Reverse geocoding helper */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
    if (!res.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const data = (await res.json()) as { label?: string };
    return data.label ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

/**
 * Google Maps-style context popup: click anywhere on the map to see an address
 * and choose "Directions from here" or "Directions to here".
 */
export function MapContextPopup({
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
            <p className="flex items-center justify-center gap-2 py-1 text-sm text-[var(--text-muted)]">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
              {t("map.loadingAddress")}
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
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
