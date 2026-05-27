"use client";

import { memo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ResultSectionHeading } from "@/components/results/ResultSectionHeading";
import { getLocalizedCountryName } from "@/lib/i18n/localizedCountryName";
import { getFuelStrategyText } from "@/lib/i18n/routeContent";
import type { TripEstimate, CountryCode } from "@/types/vignette";

export const FuelStrategyPanel = memo(function FuelStrategyPanel({ estimate }: { estimate?: TripEstimate }) {
  const { t, locale } = useI18n();
  if (!estimate) return null;

  const isFuel = estimate.powertrain !== "electric" && estimate.fuel;
  const isElectric = estimate.powertrain === "electric" && estimate.electric;
  if (!isFuel && !isElectric) return null;

  const fuel = estimate.fuel;
  const electric = estimate.electric;

  const fuelTypeLabel = isFuel
    ? fuel!.assumedFuelType === "diesel"
      ? t("fuel.diesel")
      : t("fuel.petrol")
    : t("fuel.electric");

  const needLabel = isFuel
    ? t("fuel.lNeeded").replace("{liters}", fuel!.litersNeeded.toFixed(0))
    : t("fuel.kwhNeeded").replace("{kwh}", electric!.kwhNeeded.toFixed(0));

  const rangeLabel = isFuel
    ? t("fuel.kmRange").replace("{km}", String(fuel!.estimatedRangePerFullTankKm))
    : t("fuel.kmRange").replace("{km}", String(electric!.estimatedRangePerFullChargeKm));

  const bestCountry: CountryCode | undefined = isFuel ? fuel!.bestTopUpCountryCode : electric?.bestChargeCountryCode;
  const bestPrice = isFuel ? fuel!.bestTopUpPriceEurPerLiter : electric?.bestChargePriceEurPerKwh;

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

  const tipText =
    (isFuel && getFuelStrategyText(fuel!, locale)) ||
    (bestCountry && bestPrice
      ? t("fuel.strategyFallback")
          .replace("{country}", getLocalizedCountryName(bestCountry, locale))
          .replace("{price}", bestPrice.toFixed(2))
      : null);

  const sortedPrices = [...countryPrices].sort((a, b) => {
    if (a.countryCode === bestCountry) return -1;
    if (b.countryCode === bestCountry) return 1;
    return a.price - b.price;
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <div className="px-5 pt-4">
        <ResultSectionHeading
          title={t("results.fuelStrategy")}
          subtitle={`${fuelTypeLabel} · ${needLabel} · ${rangeLabel}`}
        />
      </div>

      {tipText && (
        <div className="mx-5 mb-4 rounded-lg border border-[var(--badge-free-border)] bg-[var(--badge-free-bg)] px-4 py-2.5 text-sm text-[var(--badge-free-text)]">
          {tipText}
        </div>
      )}

      {sortedPrices.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-5 pb-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sortedPrices.map((item) => {
            const isCheapest = item.countryCode === bestCountry;
            return (
              <div
                key={item.countryCode}
                className={`min-w-[7.5rem] flex-shrink-0 rounded-xl border p-4 text-center ${
                  isCheapest
                    ? "border-[var(--badge-free-border)] bg-[var(--badge-free-bg)]"
                    : "border-[var(--border)] bg-surface-muted"
                }`}
              >
                {isCheapest && (
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--badge-free-text)]">
                    {t("fuel.cheapest")}
                  </p>
                )}
                <p className="text-lg font-bold text-[var(--text-primary)]">{item.countryCode}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {getLocalizedCountryName(item.countryCode, locale)}
                </p>
                <p
                  className={`mt-2 font-[family-name:var(--font-mono)] text-lg font-bold ${
                    isCheapest ? "text-[var(--badge-free-text)]" : "text-[var(--text-primary)]"
                  }`}
                >
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
