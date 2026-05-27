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
import { COUNTRY_NAMES as COUNTRY_LABELS } from "@/lib/config/countryNames";
import type {
  CountryCode,
  RouteAnalysisRequest,
  RouteAnalysisResult,
  TripEstimate,
  VignetteProduct,
} from "@/types/vignette";

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

export function buildTripEstimate(
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
      } else {
        vignetteBreakdown.push({
          countryCode: country.countryCode,
          productLabel: "Pricing data unavailable – check official source",
          originalPrice: { amount: 0, currency: "EUR" },
          priceEur: 0,
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

        let fuelStrategy: string | undefined;
        if (cheapest) {
          let cumulativeToStart = 0;
          let cheapestReachable = true;
          for (const segment of routeCountriesWithEstimatedDistance) {
            if (segment.countryCode === cheapest.countryCode) {
              break;
            }
            cumulativeToStart += segment.estimatedDistanceKm;
          }
          if (cumulativeToStart > estimatedRangePerFullTankKm * 0.9) {
            cheapestReachable = false;
          }

          const cheapestLabel = COUNTRY_LABELS[cheapest.countryCode];
          const cheapestPrice = cheapest.priceEurPerLiter.toFixed(2);

          if (cheapestReachable) {
            fuelStrategy = `Cheapest fuel is in ${cheapestLabel} (€${cheapestPrice}/L). You can reach it on your starting tank — fill up fully there.`;
          } else {
            const reachableCountries = routeCountriesWithEstimatedDistance
              .reduce<Array<{ countryCode: CountryCode; cumulativeEndKm: number }>>((acc, seg) => {
                const prevEnd = acc.length ? acc[acc.length - 1].cumulativeEndKm : 0;
                acc.push({ countryCode: seg.countryCode, cumulativeEndKm: prevEnd + seg.estimatedDistanceKm });
                return acc;
              }, [])
              .filter((entry) => entry.cumulativeEndKm <= estimatedRangePerFullTankKm * 0.9);

            const reachableCheapest = reachableCountries
              .map((entry) => {
                const price = routeCountryFuelPrices.find((fp) => fp.countryCode === entry.countryCode);
                return price ? { countryCode: entry.countryCode, priceEurPerLiter: price.priceEurPerLiter } : null;
              })
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
              .sort((a, b) => a.priceEurPerLiter - b.priceEurPerLiter)[0];

            if (reachableCheapest && reachableCheapest.countryCode !== cheapest.countryCode) {
              const interimLabel = COUNTRY_LABELS[reachableCheapest.countryCode];
              const interimPrice = reachableCheapest.priceEurPerLiter.toFixed(2);
              fuelStrategy = `Cheapest fuel is in ${cheapestLabel} (€${cheapestPrice}/L), but it's too far to reach on one tank. Fill up enough in ${interimLabel} (€${interimPrice}/L) to reach the border, then fill fully in ${cheapestLabel}.`;
            } else {
              fuelStrategy = `Cheapest fuel is in ${cheapestLabel} (€${cheapestPrice}/L). Consider a partial fill-up before reaching it to ensure you don't run low.`;
            }
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
          fuelStrategy,
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
