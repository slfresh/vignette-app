"use client";

import { memo, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ResultSectionHeading } from "@/components/results/ResultSectionHeading";
import { getCameraPinsForCrossings } from "@/lib/border/cameraPins";
import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import { getLocalizedCountryName } from "@/lib/i18n/localizedCountryName";
import { getTimelineActionText, getTimelineCostText } from "@/lib/i18n/routeContent";
import { getFlagEmoji } from "@/lib/utils/flagEmoji";
import type { CountryCode, RouteAnalysisResult } from "@/types/vignette";

function getBadgeClass(type: "free" | "vignette" | "toll" | "urban"): string {
  switch (type) {
    case "free":
      return "badge-free";
    case "vignette":
      return "badge-cost";
    case "toll":
      return "badge-warn";
    case "urban":
      return "badge-warn";
  }
}

interface VisualRouteTimelineProps {
  result: RouteAnalysisResult;
  onCountryHover?: (code: CountryCode | null) => void;
  onCountryClick?: (code: CountryCode) => void;
  activeCountryCode?: CountryCode | null;
}

export const VisualRouteTimeline = memo(function VisualRouteTimeline({
  result,
  onCountryHover,
  onCountryClick,
  activeCountryCode,
}: VisualRouteTimelineProps) {
  const { t, locale } = useI18n();
  const timeline = result.tripReadiness?.timeline;

  const crossingLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!result.borderCrossings?.length) return map;
    const pins = getCameraPinsForCrossings(result.borderCrossings);
    for (const pin of pins) {
      const key = `${pin.countryCodeFrom}-${pin.countryCodeTo}`;
      if (pin.nearestCameraLabel) map.set(key, pin.nearestCameraLabel);
    }
    return map;
  }, [result.borderCrossings]);

  const countryDistances = useMemo(() => {
    const map = new Map<CountryCode, number>();
    for (const country of result.countries) {
      map.set(country.countryCode, Math.round(country.highwayDistanceMeters / 1000));
    }
    return map;
  }, [result.countries]);

  const countryNotices = useMemo(() => {
    const map = new Map<CountryCode, string[]>();
    for (const country of result.countries) {
      if (country.notices?.length) map.set(country.countryCode, country.notices);
    }
    return map;
  }, [result.countries]);

  if (!timeline?.length) return null;

  return (
    <section>
      <ResultSectionHeading title={t("results.routeTimeline")} subtitle={t("timeline.mapHint")} />

      <div className="space-y-0">
        {timeline.map((entry, index) => {
          const prevEntry = index > 0 ? timeline[index - 1] : null;
          const distKm = countryDistances.get(entry.countryCode);
          const officialUrl = OFFICIAL_LINKS[entry.countryCode];
          const notices = locale === "en" ? countryNotices.get(entry.countryCode) : undefined;
          const crossingKey = prevEntry ? `${prevEntry.countryCode}-${entry.countryCode}` : null;
          const crossingLabel = crossingKey ? crossingLabelMap.get(crossingKey) : null;

          const badges: Array<{ label: string; type: "free" | "vignette" | "toll" | "urban"; icon: string }> = [];
          if (!entry.requiresVignette && !entry.requiresSectionToll) {
            badges.push({ label: t("timeline.noVignette"), type: "free", icon: "✓" });
          }
          if (entry.requiresVignette) {
            badges.push({ label: t("timeline.vignetteNeeded"), type: "vignette", icon: "🏷" });
          }
          if (entry.requiresSectionToll) {
            badges.push({ label: t("timeline.sectionToll"), type: "toll", icon: "🛣" });
          }
          if (entry.hasUrbanAccessRisk) {
            badges.push({ label: t("timeline.urbanRisk"), type: "urban", icon: "⚠" });
          }

          const costDisplay =
            entry.estimatedCostEur !== undefined && entry.estimatedCostEur > 0
              ? getTimelineCostText(entry.estimatedCostEur, locale)
              : t("timeline.noCharge");

          const actionText = entry.actionKey
            ? getTimelineActionText(entry, locale)
            : entry.action ?? "";

          return (
            <div key={`${entry.countryCode}-${index}`}>
              {prevEntry && (
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
                  <span className="whitespace-nowrap rounded-full border border-[var(--border)] bg-surface-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {crossingLabel
                      ? `${getFlagEmoji(prevEntry.countryCode)} ${crossingLabel} ${getFlagEmoji(entry.countryCode)}`
                      : `${t("timeline.borderCrossing")} · ${prevEntry.countryCode} → ${entry.countryCode}`}
                  </span>
                  <div className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
                </div>
              )}

              <div
                className={`flex cursor-pointer gap-4 rounded-2xl border bg-surface p-4 shadow-sm transition-colors sm:p-5 ${
                  activeCountryCode === entry.countryCode
                    ? "border-[var(--accent)] bg-surface-muted ring-1 ring-[var(--accent)]/30"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
                onMouseEnter={() => onCountryHover?.(entry.countryCode)}
                onMouseLeave={() => onCountryHover?.(null)}
                onClick={() => onCountryClick?.(entry.countryCode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onCountryClick?.(entry.countryCode);
                }}
                role="button"
                tabIndex={0}
                aria-label={`${getLocalizedCountryName(entry.countryCode, locale)} — ${t("timeline.mapHint")}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-muted text-xl">
                  {getFlagEmoji(entry.countryCode)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--text-primary)]">
                        <span className="mr-1 text-xs font-semibold uppercase text-[var(--text-muted)]">
                          {entry.countryCode}
                        </span>
                        {getLocalizedCountryName(entry.countryCode, locale)}
                      </p>
                      {distKm !== undefined && distKm > 0 && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {t("timeline.kmOnHighways").replace("{km}", String(distKm))}
                        </p>
                      )}
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-md border px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold ${
                        entry.estimatedCostEur && entry.estimatedCostEur > 0 ? "badge-cost" : "badge-free"
                      }`}
                    >
                      {costDisplay}
                    </span>
                  </div>

                  {(actionText || (notices && notices.length > 0)) && (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {actionText}
                      {notices?.map((notice, ni) => (
                        <span key={ni}>{actionText ? " " : ""}{notice}</span>
                      ))}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge.label}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(badge.type)}`}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    ))}
                  </div>

                  {entry.requiresVignette && officialUrl && (
                    <a
                      href={officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                    >
                      {t("timeline.buyOfficial")} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
