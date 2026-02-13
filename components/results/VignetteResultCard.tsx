"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { convertCurrencyToEur } from "@/lib/config/exchangeRates";
import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import { PRICING_2026 } from "@/lib/config/pricing2026";
import type { CountryCode, CountryTravelSummary, PowertrainType, VehicleClass, VignetteProduct } from "@/types/vignette";
import { ExternalLink } from "lucide-react";

const COUNTRY_NAMES: Record<string, string> = {
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

const FLAGS: Record<string, string> = {
  DE: "DE",
  AT: "AT",
  CZ: "CZ",
  SK: "SK",
  HU: "HU",
  SI: "SI",
  CH: "CH",
  RO: "RO",
  BG: "BG",
  HR: "HR",
  RS: "RS",
  DK: "DK",
  SE: "SE",
  NL: "NL",
  BE: "BE",
  FR: "FR",
  IT: "IT",
  BA: "BA",
  ME: "ME",
  XK: "XK",
  MK: "MK",
  AL: "AL",
  PL: "PL",
  ES: "ES",
  PT: "PT",
  GB: "GB",
  IE: "IE",
  TR: "TR",
  GR: "GR",
};

function formatPrice(value: number, currency: string) {
  if (currency === "EUR") {
    return `${value.toFixed(2)} EUR`;
  }
  return `${value.toLocaleString("en-US")} ${currency}`;
}

function formatPriceWithEurEstimate(value: number, currency: VignetteProduct["currency"]) {
  const base = formatPrice(value, currency);
  if (currency === "EUR") {
    return base;
  }
  const eur = convertCurrencyToEur(value, currency);
  return `${base} (≈ ${eur.toFixed(2)} EUR)`;
}

function productMatchScore(product: VignetteProduct, vehicleClass: VehicleClass, powertrainType: PowertrainType): number {
  const vehicleMatch = !product.vehicleTags?.length || product.vehicleTags.includes(vehicleClass);
  const powertrainMatch = !product.powertrainTags?.length || product.powertrainTags.includes(powertrainType);
  if (!vehicleMatch || !powertrainMatch) {
    return 0;
  }
  let score = 1;
  if (product.vehicleTags?.includes(vehicleClass)) {
    score += 2;
  }
  if (product.powertrainTags?.includes(powertrainType)) {
    score += 2;
  }
  return score;
}

function getCamperCaution(countryCode: string, vehicleClass: VehicleClass): string | null {
  if (vehicleClass !== "VAN_OR_MPV" && vehicleClass !== "COMMERCIAL_N1") {
    return null;
  }

  if (countryCode === "SI") {
    return "Camper vans can be class 2B in Slovenia. Verify first-axle height before purchase.";
  }
  if (countryCode === "HU") {
    return "Camper vans in Hungary may require D2 category instead of D1.";
  }
  if (countryCode === "AT") {
    return "Heavier camper vehicles in Austria can move to separate toll systems above 3.5t.";
  }
  if (countryCode === "CH") {
    return "Camper vehicles in Switzerland can trigger separate heavy-vehicle obligations by weight.";
  }

  return null;
}

function formatVehicleLabel(vehicleClass: VehicleClass): string {
  if (vehicleClass === "MOTORCYCLE") {
    return "Motorcycle";
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return "Camper van / RV";
  }
  return "Car";
}

export function VignetteResultCard({
  country,
  vehicleClass = "PASSENGER_CAR_M1",
  powertrainType = "PETROL",
  highlighted = false,
  onHover,
  onToggleLock,
}: {
  country: CountryTravelSummary;
  vehicleClass?: VehicleClass;
  powertrainType?: PowertrainType;
  highlighted?: boolean;
  onHover?: (countryCode: CountryTravelSummary["countryCode"] | null) => void;
  onToggleLock?: (countryCode: CountryCode) => void;
}) {
  const { t } = useI18n();
  const pricing = PRICING_2026[country.countryCode];
  const officialUrl = OFFICIAL_LINKS[country.countryCode];
  const prioritizedProducts = (pricing?.products ?? [])
    .map((product) => ({ product, score: productMatchScore(product, vehicleClass, powertrainType) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
  const visibleProducts = (prioritizedProducts.length ? prioritizedProducts : pricing?.products ?? []).slice(0, 4);
  const camperCaution = getCamperCaution(country.countryCode, vehicleClass);

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
        highlighted ? "border-orange-300 ring-2 ring-orange-100" : "border-zinc-200"
      } cursor-pointer`}
      onMouseEnter={() => onHover?.(country.countryCode)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onToggleLock?.(country.countryCode)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleLock?.(country.countryCode);
        }
      }}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">
          {COUNTRY_NAMES[country.countryCode]} <span className="text-sm text-zinc-500">({FLAGS[country.countryCode]})</span>
        </h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${country.requiresVignette ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
          {country.requiresVignette ? t("card.badge.vignetteNeeded") : t("card.badge.noVignette")}
        </span>
      </header>

      <p className="mt-2 text-sm text-zinc-600">
        {t("card.highwayDistance")}: {(country.highwayDistanceMeters / 1000).toFixed(1)} km
      </p>

      {camperCaution ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{camperCaution}</p> : null}

      {visibleProducts.length ? (
        <>
          <p className="mt-3 text-xs font-medium text-zinc-600">{t("card.pricesFor")}: {formatVehicleLabel(vehicleClass)}</p>
          <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1">{t("card.col.product")}</th>
              <th className="py-1">{t("card.col.price")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr key={product.id} className="border-t border-zinc-100">
                <td className="py-1 pr-2 text-zinc-800">{product.label}</td>
                <td className="py-1 text-right font-medium tabular-nums text-zinc-700">{formatPriceWithEurEstimate(product.price, product.currency)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </>
      ) : (
        <p className="mt-3 rounded-md bg-zinc-50 p-2 text-sm text-zinc-700">{t("card.noTable")}</p>
      )}

      {country.notices.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {country.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      ) : null}

      <a
        className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        href={officialUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => event.stopPropagation()}
      >
        {t("card.buyOfficial")}
        <ExternalLink className="h-4 w-4" />
      </a>
    </article>
  );
}
