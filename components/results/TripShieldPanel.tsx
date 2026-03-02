"use client";

import { getBorderWaitSources, getRouteCrossingSources } from "@/lib/border/sources";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { CountryCode, TripShieldInsights } from "@/types/vignette";
import { AlertTriangle, Clock3, ExternalLink, Globe2, ShieldCheck, TrafficCone } from "lucide-react";
import { useEffect, useState } from "react";

function boolLabel(value: boolean, onText: string, offText: string) {
  return value ? onText : offText;
}
type BorderWaitRecord = {
  crossingCode: string;
  crossingLabel: string;
  minutes: number | null;
  display: string;
  sourceLabel: string;
  sourceUrl: string;
  reliability: "official" | "aggregated" | "unknown";
};

export function TripShieldPanel({
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
  /** Only show the camera checkbox when we have camera feeds for this route's crossings */
  hasBorderCameraData?: boolean;
}) {
  const { t } = useI18n();
  const borderSources = getBorderWaitSources(routeCountries);
  const crossingSources = getRouteCrossingSources(routeCountries);
  const [waits, setWaits] = useState<BorderWaitRecord[]>([]);
  const [waitsLoading, setWaitsLoading] = useState(false);

  useEffect(() => {
    if (!tripShield?.hasBorderCrossing || routeCountries.length < 2) {
      return;
    }

    let ignore = false;
    const routeParam = encodeURIComponent(routeCountries.join(","));
    queueMicrotask(() => {
      if (!ignore) {
        setWaitsLoading(true);
      }
    });
    fetch(`/api/border-wait?route=${routeParam}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as { waits?: BorderWaitRecord[] };
      })
      .then((payload) => {
        if (ignore) {
          return;
        }
        setWaits(payload?.waits ?? []);
      })
      .catch(() => {
        if (!ignore) {
          setWaits([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setWaitsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [tripShield?.hasBorderCrossing, routeCountries]);

  const shield = tripShield;
  if (!shield) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-surface-muted p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--text-primary)]">{t("tripShield.title")}</h3>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1 text-[var(--text-primary)]">
          {boolLabel(shield.hasBorderCrossing, t("tripShield.borderCrossingYes"), t("tripShield.borderCrossingNo"))}
        </span>
        <span className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1 text-[var(--text-primary)]">
          {boolLabel(shield.hasFreeFlowToll, t("tripShield.freeFlowYes"), t("tripShield.freeFlowNo"))}
        </span>
        <span className="rounded-full border border-[var(--border-strong)] bg-surface px-3 py-1 text-[var(--text-primary)]">
          {boolLabel(shield.hasMajorUrbanZoneRisk, t("tripShield.urbanRiskYes"), t("tripShield.urbanRiskNo"))}
        </span>
      </div>

      {shield.hasBorderCrossing && hasBorderCameraData && onShowBorderCamerasChange ? (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-sm text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={showBorderCameras}
            onChange={(event) => onShowBorderCamerasChange(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)]"
          />
          {t("tripShield.showBorderCameras")}
        </label>
      ) : null}

      {shield.warnings.length ? (
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
          {shield.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              {warning.toLowerCase().includes("free-flow") ? (
                <TrafficCone className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              ) : warning.toLowerCase().includes("cross-border") ? (
                <Globe2 className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
              )}
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {shield.departureTimeHint ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-surface p-3 text-sm text-[var(--text-primary)]">
          <Clock3 className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
          <span>{shield.departureTimeHint}</span>
        </p>
      ) : null}

      {shield.tollWindowImpact ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-surface p-3 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">{shield.tollWindowImpact.title}</p>
          <p className="mt-1 text-[var(--text-primary)]">{shield.tollWindowImpact.details}</p>
          <p className="mt-1 text-[var(--text-secondary)]">Estimated impact: {shield.tollWindowImpact.estimatedDelta}</p>
        </div>
      ) : null}

      {shield.hasBorderCrossing ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-surface p-3 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">{t("tripShield.borderWaitTitle")}</p>
          {waitsLoading ? <p className="mt-1 text-[var(--text-primary)]">{t("tripShield.borderWaitLoading")}</p> : null}
          {waits.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {waits.map((wait) => (
                <a
                  key={`${wait.crossingCode}-${wait.sourceUrl}`}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-surface-muted px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-background"
                  href={wait.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {wait.crossingLabel}: {wait.display}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          ) : null}
          {crossingSources.length ? (
            <>
              <p className="mt-1 text-[var(--text-primary)]">{t("tripShield.borderWaitRouteSpecific")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {crossingSources.map((source) => (
                  <a
                    key={`${source.crossingCode}-${source.url}`}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-surface-muted px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-background"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {source.crossingLabel}: {source.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </>
          ) : null}
          {borderSources.length ? (
            <div className="mt-3">
              <p className="text-[var(--text-primary)]">{t("tripShield.borderWaitCountrySources")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
              {borderSources.map((source) => (
                <a
                  key={`${source.countryCode}-${source.url}`}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-surface-muted px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-background"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {source.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[var(--text-primary)]">{t("tripShield.borderWaitFallback")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
