"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { RouteAnalysisResult } from "@/types/vignette";

interface RouteBriefingCardProps {
  result: RouteAnalysisResult;
}

/**
 * AI-powered Route Briefing card that auto-generates when route results appear.
 *
 * Sends route coordinates and analysis to /api/ai/briefing, which
 * fetches weather, traffic, and speed camera data in parallel,
 * then streams back an LLM-generated briefing.
 *
 * Gracefully renders nothing if AI is unavailable or disabled.
 */
export const RouteBriefingCard = memo(function RouteBriefingCard({ result }: RouteBriefingCardProps) {
  const { t, locale } = useI18n();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const routeKey = result.countries.map((c) => c.countryCode).join("-");

  const generateBriefing = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

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

      if (!resp.body) {
        throw new Error("No response stream");
      }

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
      setError("Could not generate route briefing. Check that LM Studio is running.");
    } finally {
      setLoading(false);
    }
  }, [result]);

  // Auto-trigger briefing on mount / when route changes, with a short debounce
  // to avoid duplicate requests when the route is recalculated rapidly.
  useEffect(() => {
    hasFetched.current = false;
    setBriefing(null);
    setError(null);
    setAiAvailable(null);

    const timerId = setTimeout(() => {
      if (hasFetched.current) return;
      hasFetched.current = true;
      generateBriefing();
    }, 600);

    return () => {
      clearTimeout(timerId);
      abortRef.current?.abort();
    };
  }, [routeKey, generateBriefing]);

  if (aiAvailable === false) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-muted">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-base" aria-hidden>
          🛣️
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("results.aiBriefing")}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {t("results.aiBriefingSub")}
          </p>
        </div>
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        )}
      </div>

      {/* Body */}
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
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--border)]" />
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
              onClick={() => {
                hasFetched.current = false;
                generateBriefing();
              }}
              className="shrink-0 rounded-lg bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
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
    </div>
  );
});
