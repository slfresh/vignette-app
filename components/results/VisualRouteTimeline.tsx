"use client";

import { memo, useMemo } from "react";
import { getCameraPinsForCrossings } from "@/lib/border/cameraPins";
import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import type { CountryCode, RouteAnalysisResult, TripTimelineEntry } from "@/types/vignette";

const FLAG_EMOJI: Record<string, string> = {
  DE: "\u{1F1E9}\u{1F1EA}", AT: "\u{1F1E6}\u{1F1F9}", CZ: "\u{1F1E8}\u{1F1FF}", SK: "\u{1F1F8}\u{1F1F0}", HU: "\u{1F1ED}\u{1F1FA}", SI: "\u{1F1F8}\u{1F1EE}", CH: "\u{1F1E8}\u{1F1ED}", RO: "\u{1F1F7}\u{1F1F4}",
  BG: "\u{1F1E7}\u{1F1EC}", HR: "\u{1F1ED}\u{1F1F7}", RS: "\u{1F1F7}\u{1F1F8}", DK: "\u{1F1E9}\u{1F1F0}", SE: "\u{1F1F8}\u{1F1EA}", NL: "\u{1F1F3}\u{1F1F1}", BE: "\u{1F1E7}\u{1F1EA}", FR: "\u{1F1EB}\u{1F1F7}",
  IT: "\u{1F1EE}\u{1F1F9}", BA: "\u{1F1E7}\u{1F1E6}", ME: "\u{1F1F2}\u{1F1EA}", XK: "\u{1F1FD}\u{1F1F0}", MK: "\u{1F1F2}\u{1F1F0}", AL: "\u{1F1E6}\u{1F1F1}", PL: "\u{1F1F5}\u{1F1F1}", ES: "\u{1F1EA}\u{1F1F8}",
  PT: "\u{1F1F5}\u{1F1F9}", GB: "\u{1F1EC}\u{1F1E7}", IE: "\u{1F1EE}\u{1F1EA}", TR: "\u{1F1F9}\u{1F1F7}", GR: "\u{1F1EC}\u{1F1F7}",
};

const COUNTRY_NAMES: Record<CountryCode, string> = {
  DE: "Germany", AT: "Austria", CZ: "Czech Republic", SK: "Slovakia",
  HU: "Hungary", SI: "Slovenia", CH: "Switzerland", RO: "Romania",
  BG: "Bulgaria", HR: "Croatia", RS: "Serbia", DK: "Denmark",
  SE: "Sweden", NL: "Netherlands", BE: "Belgium", FR: "France",
  IT: "Italy", BA: "Bosnia & Herzegovina", ME: "Montenegro",
  XK: "Kosovo", MK: "N. Macedonia", AL: "Albania", PL: "Poland",
  ES: "Spain", PT: "Portugal", GB: "United Kingdom", IE: "Ireland",
  TR: "Turkey", GR: "Greece",
};

function getStampAccent(entry: TripTimelineEntry): string {
  if (entry.requiresVignette && entry.requiresSectionToll) return "border-[var(--accent-red)]";
  if (entry.requiresVignette) return "border-[var(--accent)]";
  if (entry.requiresSectionToll) return "border-[var(--accent)]";
  return "border-[var(--accent-green)]";
}

function getStampBg(entry: TripTimelineEntry): string {
  if (entry.requiresVignette && entry.requiresSectionToll) return "bg-[#FDF2F0]";
  if (entry.requiresVignette) return "bg-[#FDF6EC]";
  if (entry.requiresSectionToll) return "bg-[#FDF6EC]";
  return "bg-[#F0FAF4]";
}

function getBadgeDot(entry: TripTimelineEntry): string {
  if (entry.requiresVignette && entry.requiresSectionToll) return "bg-[var(--accent-red)]";
  if (entry.requiresVignette) return "bg-[var(--accent)]";
  if (entry.requiresSectionToll) return "bg-[var(--accent)]";
  return "bg-[var(--accent-green)]";
}

interface VisualRouteTimelineProps {
  result: RouteAnalysisResult;
}

export const VisualRouteTimeline = memo(function VisualRouteTimeline({ result }: VisualRouteTimelineProps) {
  const timeline = result.tripReadiness?.timeline;

  const crossingLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!result.borderCrossings?.length) return map;
    const pins = getCameraPinsForCrossings(result.borderCrossings);
    for (const pin of pins) {
      const key = `${pin.countryCodeFrom}-${pin.countryCodeTo}`;
      if (pin.nearestCameraLabel) {
        map.set(key, pin.nearestCameraLabel);
      }
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

  if (!timeline?.length) return null;

  const totalCost = timeline.reduce((sum, e) => sum + (e.estimatedCostEur ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--text-primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
            <circle cx="12" cy="5" r="1" /><path d="m9 20 3-6 3 6" /><path d="m6 8 6 2 6-2" /><path d="M12 10v4" />
          </svg>
          Route Timeline
        </h3>
        {totalCost > 0 && (
          <span className="rounded-full bg-surface-muted px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--text-secondary)]">
            Est. {totalCost.toFixed(2)} EUR
          </span>
        )}
      </div>

      {/* Horizontal scrollable journey strip */}
      <div className="overflow-x-auto px-5 py-5">
        <div className="flex items-stretch gap-0 min-w-max">
          {timeline.map((entry, index) => {
            const isFirst = index === 0;
            const isLast = index === timeline.length - 1;
            const prevEntry = index > 0 ? timeline[index - 1] : null;
            const crossingLabel = prevEntry
              ? crossingLabelMap.get(`${prevEntry.countryCode}-${entry.countryCode}`)
              : null;
            const distKm = countryDistances.get(entry.countryCode);
            const officialUrl = OFFICIAL_LINKS[entry.countryCode];

            return (
              <div key={`${entry.countryCode}-${index}`} className="flex items-stretch">
                {/* Connector line between stamps */}
                {!isFirst && (
                  <div className="flex flex-col items-center justify-center px-1">
                    <div className="flex items-center gap-1">
                      <div className="h-px w-6 bg-[var(--border-strong)]" />
                      <span className="whitespace-nowrap rounded-full border border-[var(--border)] bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {crossingLabel ?? `${FLAG_EMOJI[prevEntry!.countryCode] ?? ""}\u2192${FLAG_EMOJI[entry.countryCode] ?? ""}`}
                      </span>
                      <div className="h-px w-6 bg-[var(--border-strong)]" />
                    </div>
                  </div>
                )}

                {/* Country stamp */}
                <div className={`flex w-[180px] flex-col rounded-xl border-2 p-3.5 transition-shadow hover:shadow-md ${getStampAccent(entry)} ${getStampBg(entry)}`}>
                  {/* Flag + name header */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{FLAG_EMOJI[entry.countryCode] ?? ""}</span>
                    <div className="min-w-0">
                      <p className="truncate font-[family-name:var(--font-display)] text-sm font-bold text-[var(--text-primary)]">
                        {COUNTRY_NAMES[entry.countryCode] ?? entry.countryCode}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                        {isFirst ? "START" : isLast ? "DESTINATION" : `STOP ${index}`}
                      </p>
                    </div>
                  </div>

                  {/* Distance + cost */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {distKm !== undefined && distKm > 0 && (
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-muted)]">{distKm} km</span>
                    )}
                    {entry.estimatedCostEur !== undefined && entry.estimatedCostEur > 0 && (
                      <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--text-primary)]">
                        ~{entry.estimatedCostEur.toFixed(2)} EUR
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-[var(--text-primary)]`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${getBadgeDot(entry)}`} />
                      {entry.requiresVignette && entry.requiresSectionToll
                        ? "Vignette + Toll"
                        : entry.requiresVignette
                          ? "Vignette needed"
                          : entry.requiresSectionToll
                            ? "Section toll"
                            : "No charges"}
                    </span>
                  </div>

                  {/* Official link */}
                  {entry.requiresVignette && officialUrl && (
                    <a
                      href={officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 text-[11px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Buy vignette ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
