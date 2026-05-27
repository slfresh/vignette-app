"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TripEstimate } from "@/types/vignette";

interface StickyTripSummaryProps {
  estimate?: TripEstimate;
  anchorId: string;
}

export function StickyTripSummary({ estimate, anchorId }: StickyTripSummaryProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor || !estimate) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorId, estimate]);

  if (!estimate || !visible) return null;

  const energyCost =
    estimate.powertrain === "electric"
      ? estimate.electric?.estimatedChargingCostEur
      : estimate.fuel?.estimatedFuelCostEur;

  return (
    <div className="fixed inset-x-0 top-14 z-[8000] hidden border-b border-[var(--border)] bg-surface/95 px-4 py-2 shadow-sm backdrop-blur-md md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-sm">
        <span className="font-medium text-[var(--text-primary)]">
          {t("results.estimatedRoadCharges")}:{" "}
          <span className="font-[family-name:var(--font-mono)] text-[var(--accent)]">
            {estimate.totalRoadChargesEur.toFixed(2)} EUR
          </span>
        </span>
        <span className="text-[var(--text-secondary)]">
          {estimate.totalDistanceKm.toFixed(0)} km
          {energyCost !== undefined ? (
            <>
              {" "}
              · {t("results.fuelSeparate")}: {energyCost.toFixed(2)} EUR
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
