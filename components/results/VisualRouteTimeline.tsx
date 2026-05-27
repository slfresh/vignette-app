"use client";

import { memo, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getCameraPinsForCrossings } from "@/lib/border/cameraPins";
import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import { getFlagEmoji } from "@/lib/utils/flagEmoji";
import type { CountryCode, RouteAnalysisResult, TripTimelineEntry } from "@/types/vignette";

function getBadgeStyle(type: "free" | "vignette" | "toll" | "urban"): string {
  switch (type) {
    case "free": return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "vignette": return "border-amber-200 bg-amber-50 text-amber-800";
    case "toll": return "border-orange-200 bg-orange-50 text-orange-800";
    case "urban": return "border-orange-200 bg-orange-50 text-orange-800";
  }
}

function getFlagCircleBg(code: CountryCode): string {
  const colors: Partial<Record<CountryCode, string>> = {
    DE: "bg-zinc-800", AT: "bg-red-700", CZ: "bg-blue-700", SK: "bg-blue-600",
    HU: "bg-green-700", SI: "bg-blue-600", CH: "bg-red-600", RO: "bg-blue-700",
    BG: "bg-green-700", HR: "bg-red-600", RS: "bg-blue-700",
  };
  return colors[code] ?? "bg-zinc-600";
}

interface VisualRouteTimelineProps {
  result: RouteAnalysisResult;
}

export const VisualRouteTimeline = memo(function VisualRouteTimeline({ result }: VisualRouteTimelineProps) {
  const { t } = useI18n();
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
      <h3 className="mb-4 border-b border-[var(--border)] pb-2 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--text-primary)]">
        {t("results.routeTimeline")}
      </h3>

      <div className="space-y-0">
        {timeline.map((entry, index) => {
          const prevEntry = index > 0 ? timeline[index - 1] : null;
          const distKm = countryDistances.get(entry.countryCode);
          const officialUrl = OFFICIAL_LINKS[entry.countryCode];
          const notices = countryNotices.get(entry.countryCode);
          const crossingKey = prevEntry ? `${prevEntry.countryCode}-${entry.countryCode}` : null;
          const crossingLabel = crossingKey ? crossingLabelMap.get(crossingKey) : null;

          const badges: Array<{ label: string; type: "free" | "vignette" | "toll" | "urban"; icon: string }> = [];
          if (!entry.requiresVignette && !entry.requiresSectionToll) {
            badges.push({ label: "No vignette", type: "free", icon: "✓" });
          }
          if (entry.requiresVignette) {
            badges.push({ label: "Vignette needed", type: "vignette", icon: "🏷" });
          }
          if (entry.requiresSectionToll) {
            badges.push({ label: "Section toll", type: "toll", icon: "🛣" });
          }
          if (entry.hasUrbanAccessRisk) {
            badges.push({ label: "Urban zone risk", type: "urban", icon: "⚠" });
          }

          const costDisplay = entry.estimatedCostEur !== undefined && entry.estimatedCostEur > 0
            ? `-${entry.estimatedCostEur.toFixed(2)} EUR`
            : "No charge";

          return (
            <div key={`${entry.countryCode}-${index}`}>
              {/* Border crossing separator */}
              {prevEntry && (
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
                  <span className="whitespace-nowrap rounded-full border border-[var(--border)] bg-surface-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {crossingLabel
                      ? `${getFlagEmoji(prevEntry.countryCode)} ${crossingLabel} ${getFlagEmoji(entry.countryCode)}`
                      : `BORDER CROSSING · ${prevEntry.countryCode} → ${entry.countryCode}`}
                  </span>
                  <div className="h-px flex-1 border-t border-dashed border-[var(--border-strong)]" />
                </div>
              )}

              {/* Country card */}
              <div className="flex gap-4 rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-sm sm:p-5">
                {/* Flag circle */}
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white ${getFlagCircleBg(entry.countryCode)}`}>
                  <span className="text-xs font-bold">{entry.countryCode}</span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--text-primary)]">
                        <span className="mr-1 text-xs font-semibold uppercase text-[var(--text-muted)]">{entry.countryCode}</span>
                        {COUNTRY_NAMES[entry.countryCode] ?? entry.countryCode}
                      </p>
                      {distKm !== undefined && distKm > 0 && (
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{distKm} km on highways</p>
                      )}
                    </div>
                    <span className={`whitespace-nowrap rounded-md border px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold ${
                      entry.estimatedCostEur && entry.estimatedCostEur > 0
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}>
                      {costDisplay}
                    </span>
                  </div>

                  {/* Description from action text and notices */}
                  {(entry.action || (notices && notices.length > 0)) && (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {entry.action}
                      {notices?.map((notice, ni) => (
                        <span key={ni}>{entry.action ? " " : ""}{notice}</span>
                      ))}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span key={badge.label} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeStyle(badge.type)}`}>
                        {badge.icon} {badge.label}
                      </span>
                    ))}
                  </div>

                  {/* Official buy link */}
                  {entry.requiresVignette && officialUrl && (
                    <a
                      href={officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      Buy on {new URL(officialUrl).hostname.replace("www.", "")} ↗
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
