"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { RouteAnalysisResult } from "@/types/vignette";

interface RouteBriefingCardProps {
  result: RouteAnalysisResult;
}

export const RouteBriefingCard = memo(function RouteBriefingCard({ result }: RouteBriefingCardProps) {
  const { t, locale } = useI18n();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const routeKey = result.countries.map((c) => c.countryCode).join("-");

  useEffect(() => {
    setStarted(false);
    setBriefing(null);
    setError(null);
    setAiAvailable(null);
    abortRef.current?.abort();
  }, [routeKey]);

  const generateBriefing = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStarted(true);
    setLoading(true);
    setError(null);
    setBriefing(null);

    try {
      const resp = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          routeCoordinates: result.routeGeoJson.coordinates,
          routeResult: result,
          locale,
        }),
      });

      if (resp.status === 503) {
        setAiAvailable(false);
        return;
      }

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || "Briefing request failed");
      }

      setAiAvailable(true);

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setBriefing(accumulated);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(t("compare.couldNotCalculate"));
    } finally {
      setLoading(false);
    }
  }, [result, locale, t]);

  if (aiAvailable === false) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-muted">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-base" aria-hidden>
          🛣️
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("results.aiBriefing")}</h3>
          <p className="text-xs text-[var(--text-muted)]">{t("results.aiBriefingSub")}</p>
        </div>
        {!started && (
          <button
            type="button"
            onClick={generateBriefing}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            {t("results.generateBriefing")}
          </button>
        )}
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        )}
      </div>

      {started && (
        <div className="px-5 py-4">
          {loading && !briefing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                {t("results.aiBriefingLoading")}
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
          )}

          {briefing && (
            <div className="briefing-markdown prose prose-sm max-w-none text-[var(--text-secondary)]">
              <ReactMarkdown>{briefing}</ReactMarkdown>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--accent-red)]">{error}</p>
              <button
                type="button"
                onClick={generateBriefing}
                className="shrink-0 rounded-lg bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
              >
                {t("results.retry")}
              </button>
            </div>
          )}

          {!loading && briefing && (
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-muted)]">
              {t("results.aiBriefingDisclaimer")}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
