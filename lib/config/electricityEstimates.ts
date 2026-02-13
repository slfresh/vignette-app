import type { CountryCode, VehicleClass } from "@/types/vignette";

export const ELECTRICITY_ESTIMATES_LAST_UPDATED = "2026-02-12";

// Indicative fast-charging blended prices in EUR/kWh.
export const CHARGING_PRICE_EUR_PER_KWH: Partial<Record<CountryCode, number>> = {
  DE: 0.54,
  AT: 0.49,
  CZ: 0.43,
  SK: 0.42,
  HU: 0.39,
  SI: 0.44,
  CH: 0.58,
  RO: 0.35,
  BG: 0.33,
  HR: 0.41,
  RS: 0.37,
  DK: 0.56,
  SE: 0.47,
  NL: 0.62,
  BE: 0.55,
  FR: 0.50,
  IT: 0.57,
  BA: 0.34,
  ME: 0.35,
  MK: 0.34,
  AL: 0.35,
  PL: 0.40,
  ES: 0.46,
  PT: 0.45,
  GB: 0.58,
  IE: 0.56,
  TR: 0.29,
  GR: 0.48,
};

export function getAssumedEvConsumptionKwhPer100Km(vehicleClass: VehicleClass): number {
  if (vehicleClass === "MOTORCYCLE") {
    return 7.5;
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return 24;
  }
  return 18;
}

export function getAssumedBatteryCapacityKwh(vehicleClass: VehicleClass): number {
  if (vehicleClass === "MOTORCYCLE") {
    return 10;
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return 77;
  }
  return 64;
}
