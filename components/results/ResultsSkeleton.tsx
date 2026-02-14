"use client";

import { useEffect, useState } from "react";

/**
 * Skeleton loading placeholder shown while route analysis is in progress.
 *
 * Mimics the layout of the real results (trip shield, readiness, cost,
 * country cards, map) so the page feels responsive while the API works.
 * Shows progress stages for better perceived performance.
 */

const LOADING_STAGES = [
  "Finding your route…",
  "Analyzing countries & tolls…",
  "Checking border crossings…",
  "Calculating costs…",
] as const;

/** Rotating loading stage for screen readers and visual feedback. */
function LoadingStageIndicator() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800" role="status">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
      <span>{LOADING_STAGES[stageIndex]}</span>
    </div>
  );
}

/** A single animated shimmer bar used as a placeholder for text / content. */
function ShimmerBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for the TripShieldPanel. */
function TripShieldSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShimmerBar className="h-5 w-5 rounded-full" />
        <ShimmerBar className="h-5 w-40" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ShimmerBar className="h-8 w-32 rounded-full" />
        <ShimmerBar className="h-8 w-36 rounded-full" />
        <ShimmerBar className="h-8 w-28 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for the TripReadinessPanel (confidence score + timeline). */
function TripReadinessSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <ShimmerBar className="h-5 w-44" />
        <ShimmerBar className="h-7 w-28 rounded-full" />
      </div>
      <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <ShimmerBar className="h-4 w-32" />
        <ShimmerBar className="h-16 w-full rounded-md" />
        <ShimmerBar className="h-16 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Skeleton for the TripCostSummary. */
function TripCostSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <ShimmerBar className="h-5 w-36" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <ShimmerBar className="h-10 w-full rounded-md" />
        <ShimmerBar className="h-10 w-full rounded-md" />
        <ShimmerBar className="h-10 w-full rounded-md" />
        <ShimmerBar className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Skeleton for a single VignetteResultCard. */
function CountryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <ShimmerBar className="h-5 w-28" />
        <ShimmerBar className="h-6 w-24 rounded-full" />
      </div>
      <ShimmerBar className="mt-2 h-4 w-40" />
      <div className="mt-3 space-y-2">
        <ShimmerBar className="h-4 w-full" />
        <ShimmerBar className="h-4 w-full" />
        <ShimmerBar className="h-4 w-3/4" />
      </div>
      <ShimmerBar className="mt-4 h-10 w-full rounded-md" />
    </div>
  );
}

/** Skeleton for the sidebar (route summary + map). */
function SidebarSkeleton() {
  return (
    <aside className="grid gap-4">
      {/* Route country summary skeleton */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ShimmerBar className="h-5 w-36" />
        <div className="mt-3 space-y-2">
          <ShimmerBar className="h-6 w-full rounded-md" />
          <ShimmerBar className="h-6 w-full rounded-md" />
          <ShimmerBar className="h-6 w-full rounded-md" />
        </div>
      </div>
      {/* Map skeleton */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <ShimmerBar className="h-72 w-full rounded-none" />
      </div>
    </aside>
  );
}

/**
 * Full-page loading skeleton that mirrors the results layout.
 * Shows animated shimmer placeholders for every major section.
 */
export function ResultsSkeleton() {
  return (
    <section className="grid gap-4" aria-label="Loading results" role="status">
      <span className="sr-only">Analyzing your route, please wait...</span>

      <LoadingStageIndicator />

      <TripShieldSkeleton />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:items-start">
        <div className="grid gap-4">
          <TripReadinessSkeleton />
          <TripCostSkeleton />

          {/* Country cards — show 3 placeholder cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <CountryCardSkeleton />
            <CountryCardSkeleton />
            <CountryCardSkeleton />
          </div>
        </div>

        <SidebarSkeleton />
      </div>
    </section>
  );
}
