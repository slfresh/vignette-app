/**
 * Builds contextual information to inject into AI conversations.
 *
 * When a user has calculated a route, we serialize the key results
 * so the AI can give specific, data-driven advice about their trip.
 */

import type { RouteAnalysisResult } from "@/types/vignette";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { RouteWeatherForecast } from "@/lib/weather/openMeteo";
import type { TrafficIncident } from "@/lib/traffic/tomtom";
import type { SpeedCamera } from "@/lib/cameras/speedCameras";

/**
 * Build a compact text summary of route results for AI context.
 * Keeps token count low while providing all essential data.
 */
export function buildRouteContext(result: RouteAnalysisResult): string {
  const lines: string[] = [];

  lines.push("=== CURRENT ROUTE DATA ===");

  if (result.estimatedDurationSeconds && result.estimatedDurationSeconds > 0) {
    const hours = Math.floor(result.estimatedDurationSeconds / 3600);
    const minutes = Math.round((result.estimatedDurationSeconds % 3600) / 60);
    const eta = new Date(Date.now() + result.estimatedDurationSeconds * 1000);
    const etaFormatted = eta.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    lines.push(`Estimated driving time: ${hours}h ${minutes}m (arrival ~${etaFormatted})`);
  }

  if (result.tripEstimate) {
    const est = result.tripEstimate;
    lines.push(`Total distance: ${est.totalDistanceKm.toFixed(0)} km`);
    lines.push(`Estimated road charges: ${est.totalRoadChargesEur.toFixed(2)} EUR`);
    lines.push(`  - Vignettes: ${est.vignetteEstimateEur.toFixed(2)} EUR`);
    lines.push(`  - Section tolls: ${est.sectionTollEstimateEur.toFixed(2)} EUR`);
    if (est.fuel) {
      lines.push(`  - Fuel estimate: ~${est.fuel.estimatedFuelCostEur.toFixed(2)} EUR`);
    }
    if (est.electric) {
      lines.push(`  - Charging estimate: ~${est.electric.estimatedChargingCostEur.toFixed(2)} EUR`);
    }
  }

  lines.push("\nCountries on route:");
  for (const country of result.countries) {
    const name = COUNTRY_NAMES[country.countryCode] ?? country.countryCode;
    const vigLabel = country.requiresVignette ? "VIGNETTE NEEDED" : "no vignette";
    const tollLabel = country.requiresSectionToll ? "+ section tolls" : "";
    const distKm = (country.highwayDistanceMeters / 1000).toFixed(0);
    lines.push(`  ${country.countryCode} (${name}): ${distKm} km highway — ${vigLabel} ${tollLabel}`);

    if (country.notices?.length) {
      for (const notice of country.notices) {
        lines.push(`    ! ${notice}`);
      }
    }
  }

  if (result.borderCrossings?.length) {
    lines.push("\nBorder crossings:");
    for (const bc of result.borderCrossings) {
      lines.push(`  ${bc.countryCodeFrom} → ${bc.countryCodeTo} at (${bc.lat.toFixed(3)}, ${bc.lon.toFixed(3)})`);
    }
  }

  if (result.sectionTolls?.length) {
    lines.push("\nSection toll notices:");
    for (const toll of result.sectionTolls) {
      lines.push(`  ${toll.countryCode}: ${toll.label} — ${toll.description}`);
    }
  }

  if (result.tripShield) {
    const ts = result.tripShield;
    lines.push("\nTrip Shield:");
    lines.push(`  Border crossings: ${ts.hasBorderCrossing ? "yes" : "no"}`);
    lines.push(`  Free-flow toll risk: ${ts.hasFreeFlowToll ? "yes" : "no"}`);
    lines.push(`  Urban zone charge risk: ${ts.hasMajorUrbanZoneRisk ? "yes" : "no"}`);
  }

  lines.push("=== END ROUTE DATA ===");
  return lines.join("\n");
}

/** Format a route summary as a brief one-liner for conversation starters. */
export function buildRouteSummaryOneLiner(result: RouteAnalysisResult): string {
  const countries = result.countries.map((c) => COUNTRY_NAMES[c.countryCode] ?? c.countryCode).join(", ");
  const dist = result.tripEstimate?.totalDistanceKm?.toFixed(0) ?? "?";
  const cost = result.tripEstimate?.totalRoadChargesEur?.toFixed(2) ?? "?";
  return `Route (${dist} km, ~${cost} EUR in tolls) through ${countries}`;
}

/**
 * Build an enriched context that includes weather, traffic, and speed camera data
 * on top of the standard route analysis. Used by the AI Route Briefing feature.
 */
export function buildEnrichedRouteContext(options: {
  result: RouteAnalysisResult;
  weather?: RouteWeatherForecast;
  traffic?: TrafficIncident[];
  cameras?: SpeedCamera[];
}): string {
  const { result, weather, traffic, cameras } = options;
  const lines: string[] = [];

  lines.push(buildRouteContext(result));

  if (weather && weather.points.length > 0) {
    lines.push("\n=== WEATHER FORECAST ALONG ROUTE ===");
    for (const pt of weather.points) {
      lines.push(
        `  ${pt.label}: ${pt.temperature.toFixed(0)}°C, ${pt.weatherDescription}, wind ${pt.windSpeed.toFixed(0)} km/h (gusts ${pt.windGusts.toFixed(0)} km/h), precipitation ${pt.precipitationProbability}%, visibility ${(pt.visibility / 1000).toFixed(1)} km`,
      );
    }
    if (weather.warnings.length > 0) {
      lines.push("  WEATHER WARNINGS:");
      for (const warning of weather.warnings) {
        lines.push(`    ⚠ ${warning}`);
      }
    }
    lines.push("=== END WEATHER ===");
  }

  if (traffic && traffic.length > 0) {
    lines.push("\n=== TRAFFIC INCIDENTS ALONG ROUTE ===");
    const majorIncidents = traffic.filter((i) => i.severity === "major" || i.severity === "moderate");
    const minorIncidents = traffic.filter((i) => i.severity === "minor" || i.severity === "undefined");
    lines.push(`  Total incidents: ${traffic.length} (${majorIncidents.length} major/moderate, ${minorIncidents.length} minor)`);
    for (const incident of majorIncidents.slice(0, 10)) {
      const roadLabel = incident.roadName ? ` on ${incident.roadName}` : "";
      lines.push(`  [${incident.severity.toUpperCase()}]${roadLabel}: ${incident.description}`);
    }
    if (majorIncidents.length > 10) {
      lines.push(`  ... and ${majorIncidents.length - 10} more major/moderate incidents`);
    }
    lines.push("=== END TRAFFIC ===");
  }

  if (cameras && cameras.length > 0) {
    lines.push("\n=== SPEED CAMERAS ALONG ROUTE ===");
    lines.push(`  Total speed cameras detected: ${cameras.length}`);

    const byRoad = new Map<string, number>();
    for (const cam of cameras) {
      const road = cam.road || "Unknown road";
      byRoad.set(road, (byRoad.get(road) ?? 0) + 1);
    }
    const topRoads = Array.from(byRoad.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topRoads.length > 0) {
      lines.push("  Camera clusters (top roads):");
      for (const [road, count] of topRoads) {
        lines.push(`    ${road}: ${count} camera(s)`);
      }
    }

    const withLimits = cameras.filter((c) => c.speedLimit !== null);
    if (withLimits.length > 0) {
      const limits = withLimits.map((c) => c.speedLimit!);
      const minLimit = Math.min(...limits);
      lines.push(`  Lowest enforced speed limit: ${minLimit} km/h`);
    }

    lines.push("=== END SPEED CAMERAS ===");
  }

  return lines.join("\n");
}
