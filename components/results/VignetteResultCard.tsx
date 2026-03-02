"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { convertCurrencyToEur } from "@/lib/config/exchangeRates";
import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import { PRICING_2026 } from "@/lib/config/pricing2026";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { CountryCode, CountryTravelSummary, PowertrainType, VehicleClass, VignetteProduct } from "@/types/vignette";
import { ChevronDown, ExternalLink } from "lucide-react";

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

function formatVehicleLabel(vehicleClass: VehicleClass, t: (key: TranslationKey) => string): string {
  if (vehicleClass === "MOTORCYCLE") return t("vehicle.motorcycle");
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") return t("vehicle.camper");
  return t("vehicle.car");
}

export function VignetteResultCard({
  country,
  vehicleClass = "PASSENGER_CAR_M1",
  powertrainType = "PETROL",
  highlighted = false,
  expanded = true,
  onHover,
  onToggleLock,
  onExpandToggle,
}: {
  country: CountryTravelSummary;
  vehicleClass?: VehicleClass;
  powertrainType?: PowertrainType;
  highlighted?: boolean;
  expanded?: boolean;
  onHover?: (countryCode: CountryTravelSummary["countryCode"] | null) => void;
  onToggleLock?: (countryCode: CountryCode) => void;
  onExpandToggle?: (countryCode: CountryCode) => void;
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
      className={`overflow-hidden rounded-2xl border bg-surface shadow-sm transition-all hover:shadow-md ${
        highlighted ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/15" : "border-[var(--border)]"
      }`}
      onMouseEnter={() => onHover?.(country.countryCode)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(country.countryCode)}
      onBlur={() => onHover?.(null)}
    >
      {/* Accent stripe top */}
      <div className={`h-1 w-full ${country.requiresVignette ? "bg-[var(--accent)]" : "bg-[var(--accent-green)]"}`} />

      <header className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          onClick={() => onToggleLock?.(country.countryCode)}
          aria-label={`Select ${COUNTRY_NAMES[country.countryCode]}`}
        >
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
            {COUNTRY_NAMES[country.countryCode]} <span className="text-sm text-[var(--text-muted)]">({FLAGS[country.countryCode]})</span>
          </h3>
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${country.requiresVignette ? "bg-[#FDF2F0] text-[var(--accent-red)]" : "bg-[#F0FAF4] text-[var(--accent-green)]"}`}>
            {country.requiresVignette ? t("card.badge.vignetteNeeded") : t("card.badge.noVignette")}
          </span>
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-surface-muted hover:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${COUNTRY_NAMES[country.countryCode]} details`}
          onClick={() => onExpandToggle?.(country.countryCode)}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </button>
      </header>

      {expanded ? (
        <div className="border-t border-[var(--border)] bg-surface-muted/30 p-4 pt-3">
          <p className="text-sm text-[var(--text-muted)]">
            {t("card.highwayDistance")}: {(country.highwayDistanceMeters / 1000).toFixed(1)} km
          </p>

          {camperCaution ? <p className="mt-3 rounded-md border border-[var(--accent)]/20 bg-[#FDF6EC] p-2 text-sm text-[var(--text-secondary)]">{camperCaution}</p> : null}

          {visibleProducts.length ? (
            <>
              <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">{t("card.pricesFor")}: {formatVehicleLabel(vehicleClass, t)}</p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-muted)]">
                    <th className="py-1">{t("card.col.product")}</th>
                    <th className="py-1 text-right">{t("card.col.price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product.id} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-2 text-[var(--text-primary)]">{product.label}</td>
                      <td className="py-1.5 text-right font-[family-name:var(--font-mono)] font-medium tabular-nums text-[var(--text-primary)]">{formatPriceWithEurEstimate(product.price, product.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-3 rounded-md bg-surface-muted p-2 text-sm text-[var(--text-secondary)]">{t("card.noTable")}</p>
          )}

          {country.notices.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              {country.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          ) : null}

          <a
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            href={officialUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
          >
            {t("card.buyOfficial")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </article>
  );
}
