"use client";

import { memo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { TripEstimate, CountryCode } from "@/types/vignette";

export const FuelStrategyPanel = memo(function FuelStrategyPanel({ estimate }: { estimate?: TripEstimate }) {
  const { t } = useI18n();
  if (!estimate) return null;

  const isFuel = estimate.powertrain !== "electric" && estimate.fuel;
  const isElectric = estimate.powertrain === "electric" && estimate.electric;

  if (!isFuel && !isElectric) {
    return (
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <span aria-hidden>⛽</span>
          <p className="text-sm text-[var(--text-muted)]">Fuel data not available for this route.</p>
        </div>
      </section>
    );
  }

  const fuel = estimate.fuel;
  const electric = estimate.electric;

  const fuelTypeLabel = isFuel
    ? fuel!.assumedFuelType.charAt(0).toUpperCase() + fuel!.assumedFuelType.slice(1)
    : "Electric";

  const needLabel = isFuel
    ? `~${fuel!.litersNeeded.toFixed(0)} L needed`
    : `~${electric!.kwhNeeded.toFixed(0)} kWh needed`;

  const rangeLabel = isFuel
    ? `${fuel!.estimatedRangePerFullTankKm} km range`
    : `${electric!.estimatedRangePerFullChargeKm} km range`;

  const strategyText = isFuel
    ? fuel!.fuelStrategy
    : null;

  const bestCountry: CountryCode | undefined = isFuel
    ? fuel!.bestTopUpCountryCode
    : electric?.bestChargeCountryCode;

  const bestPrice = isFuel
    ? fuel!.bestTopUpPriceEurPerLiter
    : electric?.bestChargePriceEurPerKwh;

  const priceUnit = isFuel ? "EUR/L" : "EUR/kWh";

  const countryPrices = isFuel
    ? (fuel!.routeCountryFuelPrices ?? []).map((p) => ({
        countryCode: p.countryCode,
        price: p.priceEurPerLiter,
        unit: "EUR/L",
      }))
    : (electric?.routeCountryChargingPrices ?? []).map((p) => ({
        countryCode: p.countryCode,
        price: p.priceEurPerKwh,
        unit: "EUR/kWh",
      }));

  const cheapestCode = bestCountry;

  const tipText = strategyText
    ?? (bestCountry && bestPrice
      ? `Cheapest ${isFuel ? "fuel" : "charging"} is in ${COUNTRY_NAMES[bestCountry] ?? bestCountry} (${bestPrice.toFixed(2)} ${priceUnit}) — fill up fully at the start. You can reach it on your starting tank.`
      : null);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
          <span aria-hidden>⛽</span> {t("results.fuelStrategy")}
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          {fuelTypeLabel} · {needLabel} · {rangeLabel}
        </p>
      </div>

      {tipText && (
        <div className="mx-5 mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span className="mr-1.5">🟢</span>{tipText}
        </div>
      )}

      {countryPrices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4">
          {countryPrices.map((item) => {
            const isCheapest = item.countryCode === cheapestCode;
            return (
              <div
                key={item.countryCode}
                className={`relative rounded-xl border p-4 text-center ${
                  isCheapest
                    ? "border-emerald-400 bg-emerald-50/50"
                    : "border-[var(--border)] bg-surface-muted"
                }`}
              >
                {isCheapest && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Cheapest
                  </span>
                )}
                <p className="text-lg font-bold text-[var(--text-primary)]">{item.countryCode}</p>
                <p className="text-xs text-[var(--text-muted)]">{COUNTRY_NAMES[item.countryCode] ?? item.countryCode}</p>
                <p className={`mt-2 font-[family-name:var(--font-mono)] text-lg font-bold ${isCheapest ? "text-emerald-700" : "text-[var(--text-primary)]"}`}>
                  {item.price.toFixed(2)}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{item.unit}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});
