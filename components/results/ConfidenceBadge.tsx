"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { translate } from "@/lib/i18n/translate";
import type { ConfidenceReasonKey } from "@/types/vignette";

interface ConfidenceBadgeProps {
  score: number;
  reasonKeys: ConfidenceReasonKey[];
}

export function ConfidenceBadge({ score, reasonKeys }: ConfidenceBadgeProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  const dots = useMemo(
    () => Array.from({ length: 10 }, (_, i) => i < Math.round(score / 10)),
    [score],
  );

  const reasons = reasonKeys.map((key) => translate(locale, key));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)]"
        aria-expanded={open}
        aria-label={t("results.confidence").replace("{score}", String(score))}
      >
        {dots.map((filled, i) => (
          <span
            key={i}
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${filled ? "bg-[var(--accent-green)]" : "bg-[var(--border-strong)]"}`}
          />
        ))}
        <span className="ml-0.5">{t("results.confidence").replace("{score}", String(score))}</span>
        <span className="text-[var(--text-muted)]" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && reasons.length > 0 && (
        <div className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-surface p-3 text-left shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t("results.confidenceWhy")}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-[var(--accent)]" aria-hidden>
                  •
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
