import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import { getLocalizedCountryName } from "@/lib/i18n/localizedCountryName";
import { translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/translations";
import type { CountryCode, FuelStrategyKey, TripEstimate, TripTimelineEntry } from "@/types/vignette";

export function getTimelineActionText(entry: TripTimelineEntry, locale: Locale): string {
  return translate(locale, entry.actionKey);
}

export function getTimelineCostText(amount: number, locale: Locale): string {
  return translate(locale, "timeline.estimatedCost", { amount: amount.toFixed(2) });
}

function resolveFuelStrategyParams(
  params: Record<string, string>,
  locale: Locale,
): Record<string, string> {
  const resolved = { ...params };
  if (resolved.countryCode) {
    resolved.country = getLocalizedCountryName(resolved.countryCode as CountryCode, locale);
    delete resolved.countryCode;
  }
  if (resolved.interimCountryCode) {
    resolved.interimCountry = getLocalizedCountryName(resolved.interimCountryCode as CountryCode, locale);
    delete resolved.interimCountryCode;
  }
  return resolved;
}

export function getFuelStrategyText(
  fuel: NonNullable<TripEstimate["fuel"]>,
  locale: Locale,
): string | null {
  if (fuel.fuelStrategyKey && fuel.fuelStrategyParams) {
    return translate(
      locale,
      fuel.fuelStrategyKey,
      resolveFuelStrategyParams(fuel.fuelStrategyParams, locale),
    );
  }
  return fuel.fuelStrategy ?? null;
}

export function buildFuelStrategyParams(
  key: FuelStrategyKey,
  params: {
    countryCode: CountryCode;
    price: string;
    interimCountryCode?: CountryCode;
    interimPrice?: string;
  },
): { fuelStrategyKey: FuelStrategyKey; fuelStrategyParams: Record<string, string> } {
  const base: Record<string, string> = {
    countryCode: params.countryCode,
    price: params.price,
    country: COUNTRY_NAMES[params.countryCode] ?? params.countryCode,
  };
  if (key === "fuel.strategyTwoStop" && params.interimCountryCode && params.interimPrice) {
    return {
      fuelStrategyKey: key,
      fuelStrategyParams: {
        ...base,
        interimCountryCode: params.interimCountryCode,
        interimPrice: params.interimPrice,
        interimCountry: COUNTRY_NAMES[params.interimCountryCode] ?? params.interimCountryCode,
      },
    };
  }
  return { fuelStrategyKey: key, fuelStrategyParams: base };
}
