"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { RouteAnalysisResult } from "@/types/vignette";
import { buildRouteContext } from "@/lib/ai/contextBuilder";

interface AiTollExplainerProps {
  result: RouteAnalysisResult;
}

/**
 * AI-powered toll rule summary that appears in route results.
 *
 * Sends the route data to the local LLM and streams back a
 * plain-language summary of what vignettes/tolls the user needs.
 * Falls back to a static message when AI is unavailable.
 */
export const AiTollExplainer = memo(function AiTollExplainer({ result }: AiTollExplainerProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const routeKey = result.countries.map((c) => c.countryCode).join("-");

  const generateExplanation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);

    try {
      const routeContext = buildRouteContext(result);
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Based on the route data provided, give me a brief, practical summary of what I need to do for tolls and vignettes. " +
                "List each country I pass through and what I need to buy or prepare. " +
                "Keep it under 200 words. Use bullet points. Include approximate costs in EUR where available from the data.",
            },
          ],
          routeContext,
        }),
      });

      if (resp.status === 503) {
        setAiAvailable(false);
        return;
      }

      if (!resp.ok) {
        throw new Error("AI request failed");
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
        setExplanation(accumulated);
      }
    } catch {
      setError("Could not generate AI summary.");
    } finally {
      setLoading(false);
    }
  }, [result]);

  useEffect(() => {
    setExplanation(null);
    setExpanded(false);
  }, [routeKey]);

  if (aiAvailable === false) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface-muted">
      <button
        type="button"
        onClick={() => {
          setExpanded((prev) => !prev);
          if (!explanation && !loading && !error) {
            generateExplanation();
          }
        }}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-background"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🤖</span>
          <span className="text-sm font-semibold text-[var(--accent)]">AI Trip Summary</span>
          {!expanded && (
            <span className="text-xs text-[var(--text-muted)]">Click to generate</span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          {loading && !explanation && (
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              Generating trip summary...
            </div>
          )}

          {explanation && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
              {explanation}
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--accent-red)]">{error}</p>
              <button
                type="button"
                onClick={generateExplanation}
                className="rounded bg-surface-muted px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-background"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && explanation && (
            <p className="mt-3 text-[10px] text-[var(--text-muted)]">
              Generated by local AI — verify details with official sources.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
