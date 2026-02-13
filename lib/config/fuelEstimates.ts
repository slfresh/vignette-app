import type { CountryCode, PowertrainType, VehicleClass } from "@/types/vignette";

// Indicative reference prices (EUR per liter). Keep updated periodically.
export const FUEL_ESTIMATES_LAST_UPDATED = "2026-02-12";

export const FUEL_PRICE_EUR_PER_LITER: Partial<Record<CountryCode, number>> = {
  DE: 1.82,
  AT: 1.74,
  CZ: 1.58,
  SK: 1.60,
  HU: 1.63,
  SI: 1.67,
  CH: 1.89,
  RO: 1.52,
  BG: 1.45,
  HR: 1.63,
  RS: 1.56,
  DK: 1.94,
  SE: 1.78,
  NL: 2.02,
  BE: 1.79,
  FR: 1.88,
  IT: 1.95,
  BA: 1.49,
  ME: 1.53,
  MK: 1.47,
  AL: 1.50,
  PL: 1.56,
  ES: 1.72,
  PT: 1.79,
  GB: 1.73,
  IE: 1.81,
  TR: 1.26,
  GR: 1.90,
};

export function getAssumedConsumptionLitersPer100Km(vehicleClass: VehicleClass, powertrainType: PowertrainType = "PETROL"): number {
  if (powertrainType === "HYBRID") {
    if (vehicleClass === "MOTORCYCLE") {
      return 3.2;
    }
    if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
      return 8.5;
    }
    return 5.2;
  }

  if (vehicleClass === "MOTORCYCLE") {
    return 4.2;
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return 10.8;
  }
  return 7.2;
}

export function getAssumedFuelType(vehicleClass: VehicleClass, powertrainType: PowertrainType = "PETROL"): "petrol" | "diesel" {
  if (powertrainType === "DIESEL") {
    return "diesel";
  }
  if (powertrainType === "HYBRID") {
    return "petrol";
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return "diesel";
  }
  return "petrol";
}

export function getAssumedTankCapacityLiters(vehicleClass: VehicleClass, powertrainType: PowertrainType = "PETROL"): number {
  if (powertrainType === "HYBRID") {
    if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
      return 65;
    }
    return 45;
  }
  if (vehicleClass === "MOTORCYCLE") {
    return 16;
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return 75;
  }
  return 52;
}
