"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { CountryCode } from "@/types/vignette";
import { getAllCameraFeeds } from "@/lib/border/cameraPins";
import { getFlagEmoji } from "@/lib/utils/flagEmoji";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import { getAllHighwayCameras } from "@/lib/cameras/highwayCameras";
import type { SpeedCamera } from "@/lib/cameras/speedCameras";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cameraIcon,
  createBorderIcon,
  highwayCamIcon,
  radarIcon,
} from "@/components/map/mapIcons";

function getFlag(code: string): string {
  return getFlagEmoji(code);
}

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export function MapCameraMarkers({
  borderCrossings,
  showBorderCameras,
  speedCameras,
  showSpeedCameras,
  showHighwayCameras,
}: {
  borderCrossings: Array<{
    countryCodeFrom: CountryCode;
    countryCodeTo: CountryCode;
    lat: number;
    lon: number;
  }>;
  showBorderCameras: boolean;
  speedCameras: SpeedCamera[];
  showSpeedCameras: boolean;
  showHighwayCameras: boolean;
}) {
  const { t } = useI18n();
  const allCameraFeeds = useMemo(() => getAllCameraFeeds(), []);
  const allHighwayCameras = useMemo(() => getAllHighwayCameras(), []);

  const plainBorderCrossings = showBorderCameras ? [] : borderCrossings;

  return (
    <>
      {plainBorderCrossings.map((crossing, idx) => (
        <Marker
          key={`crossing-${idx}`}
          position={[crossing.lat, crossing.lon]}
          icon={createBorderIcon(crossing.countryCodeFrom, crossing.countryCodeTo)}
        >
          <Popup>
            <div className="min-w-[160px] text-center text-sm font-medium text-[var(--text-primary)]">
              {getFlag(crossing.countryCodeFrom)} {getCountryName(crossing.countryCodeFrom)} →{" "}
              {getFlag(crossing.countryCodeTo)} {getCountryName(crossing.countryCodeTo)}
            </div>
          </Popup>
        </Marker>
      ))}

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
                  <p className="text-base font-bold text-[var(--text-primary)]">
                    {getFlag(cam.countryCodeFrom)} {getCountryName(cam.countryCodeFrom)} ↔{" "}
                    {getFlag(cam.countryCodeTo)} {getCountryName(cam.countryCodeTo)}
                  </p>
                  <a
                    href={cam.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`View live camera at ${cam.label} border crossing`}
                    className="mt-3 block rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    🎥 {cam.label}
                    <span aria-hidden className="ml-1">↗</span>
                  </a>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{t("map.cameraFeedHint")}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}

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
                  <p className="text-sm font-bold text-[var(--danger)]">
                    {t("map.speedCameraPopup")}
                  </p>
                  {cam.speedLimit && (
                    <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                      {t("map.speedLimit")}: {cam.speedLimit} km/h
                    </p>
                  )}
                  {cam.road && (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{cam.road}</p>
                  )}
                  {cam.city && (
                    <p className="text-xs text-[var(--text-muted)]">{cam.city}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}

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
                  <p className="mt-2 text-xs text-[var(--text-muted)]">{t("map.highwayCameraHint")}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}
    </>
  );
}
