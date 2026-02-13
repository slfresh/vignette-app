import { convertCurrencyToEur } from "@/lib/config/exchangeRates";
import {
  CHARGING_PRICE_EUR_PER_KWH,
  getAssumedBatteryCapacityKwh,
  getAssumedEvConsumptionKwhPer100Km,
} from "@/lib/config/electricityEstimates";
import {
  FUEL_PRICE_EUR_PER_LITER,
  getAssumedConsumptionLitersPer100Km,
  getAssumedFuelType,
  getAssumedTankCapacityLiters,
} from "@/lib/config/fuelEstimates";
import { PRICING_2026 } from "@/lib/config/pricing2026";
import { SECTION_TOLL_ESTIMATE_EUR } from "@/lib/config/sectionTollEstimates";
import { evaluateCountryRequirement, getSectionTollNotices } from "@/lib/config/countryRules";
import { PRICE_LAST_VERIFIED_AT } from "@/lib/config/pricing2026";
import { analyzeRouteRequirements, mapCountrySummaries } from "@/lib/routing/analyzeRouteRequirements";
import type { OrsDirectionsResponse } from "@/lib/routing/orsTypes";
import type {
  CountryCode,
  RouteAnalysisRequest,
  RouteAnalysisResult,
  TripEstimate,
  TripReadiness,
  TripShieldInsights,
  TripTimelineEntry,
  VignetteProduct,
} from "@/types/vignette";

const COUNTRY_LABELS: Record<CountryCode, string> = {
  DE: "Germany",
  AT: "Austria",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  SI: "Slovenia",
  CH: "Switzerland",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  RS: "Serbia",
  DK: "Denmark",
  SE: "Sweden",
  NL: "Netherlands",
  BE: "Belgium",
  FR: "France",
  IT: "Italy",
  BA: "Bosnia and Herzegovina",
  ME: "Montenegro",
  XK: "Kosovo",
  MK: "North Macedonia",
  AL: "Albania",
  PL: "Poland",
  ES: "Spain",
  PT: "Portugal",
  GB: "United Kingdom",
  IE: "Ireland",
  TR: "Turkey",
  GR: "Greece",
};

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

function buildTripShieldInsights(
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

function getVehicleMatchedProducts(products: VignetteProduct[], request: RouteAnalysisRequest): VignetteProduct[] {
  const vehicleClass = request.vehicleClass ?? "PASSENGER_CAR_M1";
  const powertrainType = request.powertrainType ?? "PETROL";
  const matched = products.filter(
    (product) =>
      (!product.vehicleTags?.length || product.vehicleTags.includes(vehicleClass)) &&
      (!product.powertrainTags?.length || product.powertrainTags.includes(powertrainType)),
  );
  return matched.length ? matched : products;
}

function buildTripEstimate(
  result: Pick<RouteAnalysisResult, "countries" | "sectionTolls">,
  request: RouteAnalysisRequest,
  totalDistanceMeters: number,
): TripEstimate {
  const totalDistanceKm = totalDistanceMeters / 1000;
  let vignetteEstimateEur = 0;
  let sectionTollEstimateEur = 0;
  const vignetteBreakdown: TripEstimate["vignetteBreakdown"] = [];
  const sectionTollBreakdown: TripEstimate["sectionTollBreakdown"] = [];

  for (const country of result.countries) {
    if (country.requiresVignette) {
      const pricing = PRICING_2026[country.countryCode];
      const candidateProducts = pricing ? getVehicleMatchedProducts(pricing.products, request) : [];
      const cheapest = candidateProducts.reduce<VignetteProduct | null>((best, product) => {
        if (!best) {
          return product;
        }
        return product.price < best.price ? product : best;
      }, null);
      if (cheapest) {
        const converted = convertCurrencyToEur(cheapest.price, cheapest.currency);
        vignetteEstimateEur += converted;
        vignetteBreakdown.push({
          countryCode: country.countryCode,
          productLabel: cheapest.label,
          originalPrice: {
            amount: cheapest.price,
            currency: cheapest.currency,
          },
          priceEur: Number(converted.toFixed(2)),
        });
      }
    }

    if (country.requiresSectionToll) {
      const estimate = SECTION_TOLL_ESTIMATE_EUR[country.countryCode] ?? 0;
      sectionTollEstimateEur += estimate;
      if (estimate > 0) {
        sectionTollBreakdown.push({
          countryCode: country.countryCode,
          estimatedEur: Number(estimate.toFixed(2)),
        });
      }
    }
  }

  const totalRoadChargesEur = vignetteEstimateEur + sectionTollEstimateEur;
  const vehicleClass = request.vehicleClass ?? "PASSENGER_CAR_M1";
  const powertrainType = request.powertrainType ?? "PETROL";
  const isElectric = powertrainType === "ELECTRIC" || request.emissionClass === "ZERO_EMISSION";
  const totalHighwayMeters = result.countries.reduce((sum, country) => sum + country.highwayDistanceMeters, 0);
  const routeCountriesWithEstimatedDistance = result.countries.map((country) => {
    const estimatedDistanceKm = totalHighwayMeters > 0 ? (country.highwayDistanceMeters / totalHighwayMeters) * totalDistanceKm : 0;
    return {
      countryCode: country.countryCode,
      estimatedDistanceKm,
    };
  });
  const combustion = !isElectric
    ? (() => {
        const litersNeeded = (totalDistanceKm * getAssumedConsumptionLitersPer100Km(vehicleClass, powertrainType)) / 100;
        const routeCountryFuelPrices = result.countries
          .map((country) => {
            const price = FUEL_PRICE_EUR_PER_LITER[country.countryCode];
            if (!price) {
              return null;
            }
            return {
              countryCode: country.countryCode,
              priceEurPerLiter: price,
            };
          })
          .filter((entry): entry is { countryCode: CountryCode; priceEurPerLiter: number } => Boolean(entry));
        const averagePricePerLiterEur = routeCountryFuelPrices.length
          ? routeCountryFuelPrices.reduce((sum, entry) => sum + entry.priceEurPerLiter, 0) / routeCountryFuelPrices.length
          : 1.75;
        const cheapest = routeCountryFuelPrices.reduce<{ countryCode: CountryCode; priceEurPerLiter: number } | null>(
          (best, entry) => {
            if (!best) {
              return entry;
            }
            return entry.priceEurPerLiter < best.priceEurPerLiter ? entry : best;
          },
          null,
        );
        const assumedTankCapacityLiters = getAssumedTankCapacityLiters(vehicleClass, powertrainType);
        const estimatedRangePerFullTankKm =
          (assumedTankCapacityLiters / getAssumedConsumptionLitersPer100Km(vehicleClass, powertrainType)) * 100;
        const suggestedTopUpCountries: CountryCode[] = [];
        if (totalDistanceKm > estimatedRangePerFullTankKm && routeCountriesWithEstimatedDistance.length) {
          const checkpointDistance = estimatedRangePerFullTankKm * 0.85;
          let cumulative = 0;
          for (const segment of routeCountriesWithEstimatedDistance) {
            cumulative += segment.estimatedDistanceKm;
            if (cumulative >= checkpointDistance) {
              suggestedTopUpCountries.push(segment.countryCode);
              break;
            }
          }
          if (cheapest && !suggestedTopUpCountries.includes(cheapest.countryCode)) {
            suggestedTopUpCountries.push(cheapest.countryCode);
          }
        }
        return {
          assumedFuelType: getAssumedFuelType(vehicleClass, powertrainType),
          litersNeeded: Number(litersNeeded.toFixed(1)),
          averagePricePerLiterEur: Number(averagePricePerLiterEur.toFixed(2)),
          estimatedFuelCostEur: Number((litersNeeded * averagePricePerLiterEur).toFixed(2)),
          bestTopUpCountryCode: cheapest?.countryCode,
          bestTopUpPriceEurPerLiter: cheapest?.priceEurPerLiter,
          routeCountryFuelPrices,
          estimatedRangePerFullTankKm: Number(estimatedRangePerFullTankKm.toFixed(0)),
          suggestedTopUpCountries,
        };
      })()
    : undefined;
  const electric = isElectric
    ? (() => {
        const kwhNeeded = (totalDistanceKm * getAssumedEvConsumptionKwhPer100Km(vehicleClass)) / 100;
        const routeCountryChargingPrices = result.countries
          .map((country) => {
            const price = CHARGING_PRICE_EUR_PER_KWH[country.countryCode];
            if (!price) {
              return null;
            }
            return {
              countryCode: country.countryCode,
              priceEurPerKwh: price,
            };
          })
          .filter((entry): entry is { countryCode: CountryCode; priceEurPerKwh: number } => Boolean(entry));
        const averagePricePerKwhEur = routeCountryChargingPrices.length
          ? routeCountryChargingPrices.reduce((sum, entry) => sum + entry.priceEurPerKwh, 0) / routeCountryChargingPrices.length
          : 0.46;
        const cheapest = routeCountryChargingPrices.reduce<{ countryCode: CountryCode; priceEurPerKwh: number } | null>(
          (best, entry) => {
            if (!best) {
              return entry;
            }
            return entry.priceEurPerKwh < best.priceEurPerKwh ? entry : best;
          },
          null,
        );
        const estimatedRangePerFullChargeKm =
          (getAssumedBatteryCapacityKwh(vehicleClass) / getAssumedEvConsumptionKwhPer100Km(vehicleClass)) * 100;
        const suggestedChargeCountries: CountryCode[] = [];
        if (totalDistanceKm > estimatedRangePerFullChargeKm && routeCountriesWithEstimatedDistance.length) {
          const checkpointDistance = estimatedRangePerFullChargeKm * 0.8;
          let cumulative = 0;
          for (const segment of routeCountriesWithEstimatedDistance) {
            cumulative += segment.estimatedDistanceKm;
            if (cumulative >= checkpointDistance) {
              suggestedChargeCountries.push(segment.countryCode);
              break;
            }
          }
          if (cheapest && !suggestedChargeCountries.includes(cheapest.countryCode)) {
            suggestedChargeCountries.push(cheapest.countryCode);
          }
        }
        return {
          kwhNeeded: Number(kwhNeeded.toFixed(1)),
          averagePricePerKwhEur: Number(averagePricePerKwhEur.toFixed(2)),
          estimatedChargingCostEur: Number((kwhNeeded * averagePricePerKwhEur).toFixed(2)),
          bestChargeCountryCode: cheapest?.countryCode,
          bestChargePriceEurPerKwh: cheapest?.priceEurPerKwh,
          routeCountryChargingPrices,
          estimatedRangePerFullChargeKm: Number(estimatedRangePerFullChargeKm.toFixed(0)),
          suggestedChargeCountries,
        };
      })()
    : undefined;

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    vignetteEstimateEur: Number(vignetteEstimateEur.toFixed(2)),
    sectionTollEstimateEur: Number(sectionTollEstimateEur.toFixed(2)),
    totalRoadChargesEur: Number(totalRoadChargesEur.toFixed(2)),
    vignetteBreakdown,
    sectionTollBreakdown,
    powertrain: isElectric ? "electric" : "combustion",
    fuel: combustion,
    electric,
    assumptions: [
      "Road charge total is an estimate based on cheapest matching vignette products and reference section toll amounts.",
      isElectric
        ? "Charging estimate uses a vehicle-class EV consumption baseline and indicative charging prices."
        : "Fuel estimate uses a vehicle-class consumption baseline and indicative country fuel prices.",
      "Cost totals are indicative and shown with estimate uncertainty, not invoice-level precision.",
      "Exchange rates and fuel prices are reference values and should be checked before payment.",
    ],
  };
}

function buildTripReadiness(
  result: Pick<RouteAnalysisResult, "countries" | "sectionTolls" | "tripShield">,
  request: RouteAnalysisRequest,
  tripEstimate: TripEstimate,
): TripReadiness {
  const vignetteCostByCountry = new Map<CountryCode, number>();
  for (const item of tripEstimate.vignetteBreakdown) {
    vignetteCostByCountry.set(item.countryCode, (vignetteCostByCountry.get(item.countryCode) ?? 0) + item.priceEur);
  }
  const sectionCostByCountry = new Map<CountryCode, number>();
  for (const item of tripEstimate.sectionTollBreakdown) {
    sectionCostByCountry.set(item.countryCode, (sectionCostByCountry.get(item.countryCode) ?? 0) + item.estimatedEur);
  }

  const timeline: TripTimelineEntry[] = result.countries.map((country) => {
    const countryNoticeText = country.notices.join(" ").toLowerCase();
    const hasUrbanAccessRisk =
      countryNoticeText.includes("ulez") ||
      countryNoticeText.includes("congestion") ||
      countryNoticeText.includes("crit'air") ||
      countryNoticeText.includes("umwelt") ||
      countryNoticeText.includes("low-emission");
    const action = country.requiresVignette
      ? "Buy national vignette before highway entry."
      : country.requiresSectionToll
        ? "Prepare section/distance toll payment for this country."
        : "No national vignette expected on standard passenger routes.";
    const estimatedCostEur = (vignetteCostByCountry.get(country.countryCode) ?? 0) + (sectionCostByCountry.get(country.countryCode) ?? 0);
    return {
      countryCode: country.countryCode,
      label: COUNTRY_LABELS[country.countryCode],
      action,
      estimatedCostEur: estimatedCostEur > 0 ? Number(estimatedCostEur.toFixed(2)) : undefined,
      requiresVignette: country.requiresVignette,
      requiresSectionToll: country.requiresSectionToll,
      hasUrbanAccessRisk,
    };
  });

  const checklist = new Set<string>();
  if (result.countries.some((country) => country.requiresVignette)) {
    checklist.add("Buy required vignettes before departure and keep confirmation receipts.");
  }
  if (result.countries.some((country) => country.requiresSectionToll)) {
    checklist.add("Review section toll notes and official links for each toll country.");
  }
  if (result.tripShield?.hasFreeFlowToll) {
    checklist.add("For free-flow corridors, verify payment completion windows (often 72h).");
  }
  if (result.tripShield?.hasMajorUrbanZoneRisk) {
    checklist.add("Check city emission/urban access zones (ULEZ/Crit'Air/Umwelt) before entry.");
  }
  if (result.tripShield?.hasBorderCrossing) {
    checklist.add("Carry registration and identity documents for all border crossings.");
  }
  if ((request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") && request.grossWeightKg === undefined) {
    checklist.add("Add vehicle gross weight to improve toll category accuracy.");
  }
  if (request.powertrainType === "ELECTRIC") {
    checklist.add("Plan charging stops with backup chargers on long-distance segments.");
  }

  let confidenceScore = 100;
  const confidenceReasons: string[] = [];
  if (!request.dateISO) {
    confidenceScore -= 10;
    confidenceReasons.push("Trip date missing, so time-window toll hints are less precise.");
  }
  if (!request.powertrainType) {
    confidenceScore -= 8;
    confidenceReasons.push("Powertrain type missing, fuel/energy estimates use defaults.");
  }
  if (request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") {
    if (request.grossWeightKg === undefined) {
      confidenceScore -= 12;
      confidenceReasons.push("Gross weight missing for van/camper profile.");
    }
    if (request.axles === undefined) {
      confidenceScore -= 8;
      confidenceReasons.push("Axle count missing for van/camper profile.");
    }
  }
  if (request.emissionClass === "UNKNOWN") {
    confidenceScore -= 8;
    confidenceReasons.push("Emission class unknown, urban-zone checks are conservative.");
  }
  if (result.countries.length >= 4) {
    confidenceScore -= 6;
    confidenceReasons.push("Multi-country route complexity increases pricing uncertainty.");
  }
  if (result.countries.some((country) => country.requiresSectionToll) && tripEstimate.sectionTollBreakdown.length === 0) {
    confidenceScore -= 10;
    confidenceReasons.push("Some section toll segments lack country-specific estimate values.");
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const confidenceLevel: TripReadiness["confidenceLevel"] =
    confidenceScore >= 80 ? "high" : confidenceScore >= 55 ? "medium" : "low";

  if (!confidenceReasons.length) {
    confidenceReasons.push("Route profile includes enough details for a strong estimate baseline.");
  }

  return {
    confidenceScore,
    confidenceLevel,
    confidenceReasons,
    timeline,
    checklist: Array.from(checklist),
  };
}

export function applyCountryRules(
  response: OrsDirectionsResponse,
  request: RouteAnalysisRequest,
): RouteAnalysisResult {
  const draft = analyzeRouteRequirements(response, request);

  const countries = mapCountrySummaries(draft, (countryCode, hasHighway, hasTollway) =>
    evaluateCountryRequirement(countryCode, hasHighway, hasTollway, request),
  );
  const routeCountries = countries.map((country) => country.countryCode);

  const sectionTolls = countries
    .filter((country) => country.requiresSectionToll)
    .flatMap((country) => getSectionTollNotices(country.countryCode, request, routeCountries));
  const tripShield = buildTripShieldInsights({ countries, sectionTolls }, request);
  const tripEstimate = buildTripEstimate({ countries, sectionTolls }, request, draft.totalDistanceMeters);
  const tripReadiness = buildTripReadiness({ countries, sectionTolls, tripShield }, request, tripEstimate);

  return {
    routeGeoJson: draft.lineString,
    countries,
    sectionTolls,
    tripEstimate,
    tripShield,
    tripReadiness,
    compliance: {
      official_source: true,
      informational_only: true,
      price_last_verified_at: PRICE_LAST_VERIFIED_AT,
    },
  };
}
