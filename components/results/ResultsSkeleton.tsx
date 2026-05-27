"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

const LOADING_STAGE_KEYS = ["loading.stage1", "loading.stage2", "loading.stage3", "loading.stage4"] as const;

function ShimmerBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--border)] ${className}`} aria-hidden="true" />;
}

function LoadingStageIndicator() {
  const { t } = useI18n();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGE_KEYS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-surface-muted px-3 py-2 text-sm text-[var(--accent)]"
      role="status"
      aria-label={t(LOADING_STAGE_KEYS[stageIndex])}
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
      <span>{t(LOADING_STAGE_KEYS[stageIndex])}</span>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <section className="grid gap-8" aria-label="Loading results" role="status">
      <LoadingStageIndicator />

      {/* Budget hero skeleton */}
      <div>
        <ShimmerBar className="h-3 w-40" />
        <ShimmerBar className="mt-3 h-8 w-72" />
        <div className="mt-6 overflow-hidden rounded-2xl bg-[#1a1a1f] p-6">
          <ShimmerBar className="h-3 w-48 bg-white/20" />
          <ShimmerBar className="mt-4 h-12 w-56 bg-white/20" />
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <ShimmerBar key={i} className="h-14 bg-white/10" />
            ))}
          </div>
        </div>
      </div>

      {/* Briefing card skeleton */}
      <div className="rounded-2xl border border-[var(--border)] p-5">
        <ShimmerBar className="h-4 w-48" />
        <ShimmerBar className="mt-3 h-3 w-full" />
      </div>

      {/* Timeline cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-[var(--border)] p-5">
          <div className="flex gap-4">
            <ShimmerBar className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-40" />
              <ShimmerBar className="h-3 w-full" />
              <ShimmerBar className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}

      {/* Trip shield */}
      <div className="rounded-2xl border border-[var(--border)] p-5">
        <ShimmerBar className="h-4 w-36" />
        <div className="mt-3 flex gap-2">
          <ShimmerBar className="h-6 w-28 rounded-full" />
          <ShimmerBar className="h-6 w-32 rounded-full" />
        </div>
      </div>

      {/* Fuel cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <ShimmerBar key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
