"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { buildSummaryText } from "@/lib/utils/shareSummary";
import type { RouteAnalysisResult } from "@/types/vignette";

interface ShareActionsProps {
  result: RouteAnalysisResult;
  onOpenAiChat: () => void;
}

export function ShareActions({ result, onOpenAiChat }: ShareActionsProps) {
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const summaryText = useMemo(() => buildSummaryText(result), [result]);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(summaryText.split("\n")[0] || "Trip summary")}&body=${encodeURIComponent(summaryText)}`;

  async function handleCopy() {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyState("copied");
    } catch { /* noop */ }
    setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="flex-1 rounded-xl bg-[#1a1a1f] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a2a2f] sm:flex-none"
      >
        {copyState === "copied" ? `✓ ${t("results.copied")}` : t("results.copySummary")}
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="flex-1 rounded-xl border border-[var(--border)] bg-surface px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:bg-surface-muted sm:flex-none"
      >
        {t("results.shareWhatsApp")}
      </a>
      <a
        href={emailUrl}
        className="flex-1 rounded-xl border border-[var(--border)] bg-surface px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:bg-surface-muted sm:flex-none"
      >
        {t("results.shareEmail")}
      </a>
      <button
        type="button"
        onClick={onOpenAiChat}
        className="flex-1 rounded-xl border border-[var(--border)] bg-surface px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-surface-muted sm:flex-none"
      >
        {t("results.askAi")}
      </button>
    </div>
  );
}
