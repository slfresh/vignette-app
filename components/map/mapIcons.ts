import L from "leaflet";
import { getFlagEmoji } from "@/lib/utils/flagEmoji";

/** Green A marker for start */
export const startIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#22c55e;color:white;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">A</div>`,
  className: "map-picker-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Red B marker for destination */
export const destIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#ef4444;color:white;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">B</div>`,
  className: "map-picker-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Blue pulsing dot for user's geolocation */
export const geoIcon = L.divIcon({
  html: `<div class="geo-dot"></div>`,
  className: "geo-dot-wrapper",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Camera icon SVG for border crossing pins */
const cameraIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;

export const cameraIcon = L.divIcon({
  html: `<div class="camera-icon-circle">${cameraIconSvg}</div>`,
  className: "border-camera-pin",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

/** Speed camera (radar) icon — red triangle with exclamation */
const radarIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

export const radarIcon = L.divIcon({
  html: `<div class="radar-icon-circle">${radarIconSvg}</div>`,
  className: "speed-camera-pin",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

/** Highway camera icon — road/film SVG in orange */
const highwayCamSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;

export const highwayCamIcon = L.divIcon({
  html: `<div class="highway-cam-icon-circle">${highwayCamSvg}</div>`,
  className: "highway-camera-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

/** Small purple dot shown at the clicked location while the context popup is open. */
export const contextPinIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#6366f1;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: "context-pin",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

/** Creates a flag-pair icon for plain border crossings (no camera). */
export function createBorderIcon(codeFrom: string, codeTo: string): L.DivIcon {
  const flagFrom = getFlagEmoji(codeFrom);
  const flagTo = getFlagEmoji(codeTo);
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;gap:1px;width:44px;height:26px;border-radius:13px;background:var(--surface);border:2px solid var(--border-strong);box-shadow:0 2px 4px rgba(0,0,0,0.15);font-size:13px;line-height:1">${flagFrom}${flagTo}</div>`,
    className: "border-crossing-pin",
    iconSize: [44, 26],
    iconAnchor: [22, 13],
    popupAnchor: [0, -13],
  });
}
