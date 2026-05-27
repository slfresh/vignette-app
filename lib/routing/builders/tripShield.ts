import { COUNTRY_NAMES as COUNTRY_LABELS } from "@/lib/config/countryNames";
import type {
  CountryCode,
  RouteAnalysisRequest,
  RouteAnalysisResult,
  TripShieldInsights,
} from "@/types/vignette";

function resolveUrbanRiskLocations(request: RouteAnalysisRequest, routeCountryCodes: CountryCode[]): string[] {
  const text = `${request.start} ${request.end}`.toLowerCase();
  const results = new Set<string>();
  const cityHints: Array<{ city: string; countryCode: CountryCode; label: string }> = [
    { city: "berlin", countryCode: "DE", label: "Berlin (Germany)" },
    { city: "munich", countryCode: "DE", label: "Munich (Germany)" },
    { city: "paris", countryCode: "FR", label: "Paris (France)" },
    { city: "lyon", countryCode: "FR", label: "Lyon (France)" },
    { city: "marseille", countryCode: "FR", label: "Marseille (France)" },
    { city: "milan", countryCode: "IT", label: "Milan (Italy)" },
    { city: "london", countryCode: "GB", label: "London (United Kingdom)" },
  ];

  for (const hint of cityHints) {
    if (text.includes(hint.city) && routeCountryCodes.includes(hint.countryCode)) {
      results.add(hint.label);
    }
  }

  return Array.from(results);
}

function buildFranceTollWindowImpact(request: RouteAnalysisRequest): TripShieldInsights["tollWindowImpact"] {
  const dateText = request.dateISO?.trim();
  if (!dateText) {
    return {
      countryCode: "FR",
      level: "neutral",
      title: "Add trip date for a sharper toll timing hint",
      details: "French toll corridors can use time-based modulation. Set a date so we can show a better discount/surcharge hint.",
      estimatedDelta: "Up to +/-25% on selected corridors",
    };
  }

  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return {
      countryCode: "FR",
      level: "neutral",
      title: "Date format not recognized for toll timing check",
      details: "Please use the trip date field to enable time-window toll hints.",
      estimatedDelta: "Up to +/-25% on selected corridors",
    };
  }

  const weekday = parsed.getUTCDay();
  if (weekday === 0) {
    return {
      countryCode: "FR",
      level: "savings_opportunity",
      title: "Sunday departure can reduce toll cost on some French corridors",
      details: "Selected routes can offer lower off-peak tariffs during Sunday travel windows.",
      estimatedDelta: "Potential savings: up to ~25%",
    };
  }

  if (weekday === 5) {
    return {
      countryCode: "FR",
      level: "surcharge_risk",
      title: "Friday travel can hit peak toll windows",
      details: "Late-afternoon and evening travel windows on selected corridors can be priced higher.",
      estimatedDelta: "Potential increase: up to ~25%",
    };
  }

  return {
    countryCode: "FR",
    level: "neutral",
    title: "Check departure hour for possible toll savings",
    details: "Some French corridors change tariffs by time window. Small schedule changes can reduce cost.",
    estimatedDelta: "Possible range: roughly -25% to +25%",
  };
}

export function buildTripShieldInsights(
  result: Pick<RouteAnalysisResult, "countries" | "sectionTolls">,
  request: RouteAnalysisRequest,
): TripShieldInsights {
  const joinedCountryNotices = result.countries.flatMap((country) => country.notices).join(" ").toLowerCase();
  const joinedSectionNotices = result.sectionTolls
    .map((notice) => `${notice.label} ${notice.description}`)
    .join(" ")
    .toLowerCase();
  const allNoticeText = `${joinedCountryNotices} ${joinedSectionNotices}`.trim();

  const hasBorderCrossing = result.countries.length > 1;
  const hasFreeFlowToll =
    allNoticeText.includes("free-flow") ||
    allNoticeText.includes("flux libre") ||
    result.sectionTolls.some((notice) => notice.label.includes("Flux Libre"));
  const hasMajorUrbanZoneRisk =
    allNoticeText.includes("ulez") ||
    allNoticeText.includes("congestion charge") ||
    allNoticeText.includes("crit'air") ||
    allNoticeText.includes("umweltplakette") ||
    allNoticeText.includes("low-emission");
  const urbanRiskCountries = result.countries
    .filter((country) =>
      country.notices.some((notice) => {
        const text = notice.toLowerCase();
        return (
          text.includes("ulez") ||
          text.includes("congestion") ||
          text.includes("crit'air") ||
          text.includes("umwelt") ||
          text.includes("low-emission")
        );
      }),
    )
    .map((country) => COUNTRY_LABELS[country.countryCode]);
  const routeCountryCodes = result.countries.map((country) => country.countryCode);
  const urbanRiskLocations = resolveUrbanRiskLocations(request, routeCountryCodes);

  const warnings: string[] = [];
  if (hasFreeFlowToll) {
    warnings.push("France free-flow toll may require payment within 72 hours after travel.");
  }
  if (hasMajorUrbanZoneRisk) {
    if (urbanRiskLocations.length) {
      warnings.push(`Urban access/emission zone risk near: ${urbanRiskLocations.join(", ")}.`);
    } else if (urbanRiskCountries.length) {
      warnings.push(`Urban access/emission zone risk in: ${urbanRiskCountries.join(", ")}.`);
    } else {
      warnings.push("Urban access or emission zone charges may apply near major cities on this route.");
    }
  }
  if (hasBorderCrossing) {
    warnings.push("Cross-border trip detected. Carry registration and check country-specific payment rules before departure.");
  }

  const hasFranceTollSections = result.sectionTolls.some((notice) => notice.countryCode === "FR");
  const hasFranceTimeWindowPricing = result.sectionTolls.some((notice) => notice.label.includes("A1/A14 time-window"));
  if (hasFranceTimeWindowPricing) {
    warnings.push("France A1/A14 peak windows may cost more than nearby off-peak windows.");
  }
  const departureTimeHint = hasFranceTollSections
    ? "Departure-time hint: some French corridors use time-based toll modulation. If your schedule is flexible, compare nearby departure windows."
    : undefined;
  const tollWindowImpact = hasFranceTollSections ? buildFranceTollWindowImpact(request) : undefined;

  return {
    hasFreeFlowToll,
    hasMajorUrbanZoneRisk,
    hasBorderCrossing,
    departureTimeHint,
    tollWindowImpact,
    warnings,
  };
}
