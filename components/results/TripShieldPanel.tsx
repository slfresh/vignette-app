"use client";

import { memo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { CountryCode, TripShieldInsights } from "@/types/vignette";
import { ShieldCheck } from "lucide-react";

function badgeColor(positive: boolean, warning: boolean): string {
  if (warning) return "border-orange-200 bg-orange-50 text-orange-800";
  if (positive) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

export const TripShieldPanel = memo(function TripShieldPanel({
  tripShield,
  routeCountries = [],
  showBorderCameras = false,
  onShowBorderCamerasChange,
  hasBorderCameraData = false,
}: {
  tripShield?: TripShieldInsights;
  routeCountries?: CountryCode[];
  showBorderCameras?: boolean;
  onShowBorderCamerasChange?: (checked: boolean) => void;
  hasBorderCameraData?: boolean;
}) {
  const { t } = useI18n();
  const shield = tripShield;
  if (!shield) return null;

  const badges: Array<{ label: string; positive: boolean; warning: boolean }> = [];

  if (shield.hasBorderCrossing) {
    badges.push({ label: t("tripShield.borderCrossingYes"), positive: true, warning: false });
  }

  if (routeCountries.length > 1) {
    badges.push({ label: t("tripShield.crossBorderRules"), positive: true, warning: false });
  }

  if (shield.hasMajorUrbanZoneRisk) {
    badges.push({ label: t("tripShield.urbanRiskYes"), positive: false, warning: true });
  }

  if (shield.hasFreeFlowToll) {
    const freeFlowLabel = shield.tollWindowImpact?.level === "surcharge_risk"
      ? t("tripShield.freeFlowHigh")
      : t("tripShield.freeFlowLow");
    badges.push({ label: freeFlowLabel, positive: false, warning: false });
  }

  const advisoryText = shield.warnings.length > 0
    ? shield.warnings.join(" ")
    : shield.hasBorderCrossing
      ? t("tripShield.advisoryDefault")
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <div className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--text-muted)]" />
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
            {t("tripShield.title")}
          </h3>
        </div>

        {badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${badgeColor(badge.positive, badge.warning)}`}
              >
                {badge.positive ? "✓" : badge.warning ? "⚠" : "ℹ"} {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Camera toggle */}
        {shield.hasBorderCrossing && hasBorderCameraData && onShowBorderCamerasChange && (
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-surface-muted px-3 py-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={showBorderCameras}
              onChange={(e) => onShowBorderCamerasChange(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)]"
            />
            {t("tripShield.showBorderCameras")}
          </label>
        )}

        {advisoryText && (
          <div className="mt-4 border-l-4 border-[var(--accent)] bg-surface-muted py-3 pl-4 pr-4 text-sm leading-relaxed text-[var(--text-secondary)]">
            {advisoryText}
          </div>
        )}
      </div>
    </section>
  );
});
