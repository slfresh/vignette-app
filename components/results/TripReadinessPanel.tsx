"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { OFFICIAL_LINKS, SECTION_TOLL_LINKS } from "@/lib/config/officialLinks";
import type { RouteAnalysisResult } from "@/types/vignette";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from "lucide-react";

function getUrbanZoneLink(countryCode: string): string | null {
  if (countryCode === "GB") {
    return "https://tfl.gov.uk/modes/driving/check-your-vehicle/";
  }
  if (countryCode === "FR") {
    return "https://www.certificat-air.gouv.fr/";
  }
  if (countryCode === "DE") {
    return "https://www.umwelt-plakette.de/en/";
  }
  return null;
}

function scoreClasses(level: "high" | "medium" | "low"): string {
  if (level === "high") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (level === "medium") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-red-100 text-red-800 border-red-200";
}

export function TripReadinessPanel({ result }: { result: RouteAnalysisResult }) {
  const { t } = useI18n();
  const readiness = result.tripReadiness;
  if (!readiness) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
          <ShieldCheck className="h-5 w-5 text-zinc-700" />
          {t("readiness.title")}
        </h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreClasses(readiness.confidenceLevel)}`}>
          {t("readiness.confidenceLabel")} {readiness.confidenceScore}/100
        </span>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-900">{t("readiness.routeTimeline")}</p>
        <ul className="mt-2 space-y-2 text-sm text-zinc-800">
          {readiness.timeline.map((entry) => (
            <li key={`${entry.countryCode}-${entry.label}`} className="rounded border border-zinc-200 bg-white p-2">
              <p className="font-medium">
                {entry.label} ({entry.countryCode})
                {entry.estimatedCostEur ? <span className="ml-2 text-zinc-500">~{entry.estimatedCostEur.toFixed(2)} EUR</span> : null}
              </p>
              <p className="mt-1 text-zinc-700">{entry.action}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-blue-700">{t("readiness.officialLinks")}</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.requiresVignette ? (
                    <a
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                      href={OFFICIAL_LINKS[entry.countryCode]}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Buy vignette
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {entry.requiresSectionToll ? (
                    <a
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                      href={SECTION_TOLL_LINKS[entry.countryCode] ?? OFFICIAL_LINKS[entry.countryCode]}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Pay section toll
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {entry.hasUrbanAccessRisk && getUrbanZoneLink(entry.countryCode) ? (
                    <a
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                      href={getUrbanZoneLink(entry.countryCode) ?? undefined}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Urban zone info
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {result.sectionTolls
                    .filter((notice) => notice.countryCode === entry.countryCode && Boolean(notice.officialUrl))
                    .slice(0, 2)
                    .map((notice) => (
                      <a
                        key={`${entry.countryCode}-${notice.label}`}
                        className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-100"
                        href={notice.officialUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {notice.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-900">{t("readiness.checklist")}</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-800">
          {readiness.checklist.map((item) => (
            <li key={item} className="inline-flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-900">{t("readiness.confidenceNotes")}</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-800">
          {readiness.confidenceReasons.map((reason) => (
            <li key={reason} className="inline-flex items-start gap-2">
              {readiness.confidenceLevel === "low" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
              ) : (
                <Clock3 className="mt-0.5 h-4 w-4 text-amber-700" />
              )}
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
