"use client";

import { FEATURE_FLAGS } from "@/lib/config/featureFlags";
import { readConsentFromStorage, subscribeConsentChange } from "@/lib/legal/consent";
import { useSyncExternalStore } from "react";

export function MonetizationPanel({ estimatedSavingsEuro }: { estimatedSavingsEuro: number }) {
  const consent = useSyncExternalStore(subscribeConsentChange, readConsentFromStorage, () => "unset");
  const hasConsent = consent === "accepted";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">Optional extras</h3>
      <p className="mt-1 text-sm text-zinc-700">
        Estimated avoided reseller markup: <span className="font-semibold">{estimatedSavingsEuro.toFixed(2)} EUR</span>
      </p>

      {FEATURE_FLAGS.donationsEnabled ? (
        <a
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          href="https://ko-fi.com/eurodrive"
          target="_blank"
          rel="noreferrer noopener"
        >
          ☕ Support EuroDrive
          <span className="text-xs font-normal opacity-90">— help keep the servers running</span>
        </a>
      ) : null}

      {hasConsent && FEATURE_FLAGS.insuranceAffiliateEnabled ? (
        <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
          Sponsored: travel insurance recommendations for your route.
        </div>
      ) : null}

      {hasConsent && FEATURE_FLAGS.accommodationAffiliateEnabled ? (
        <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
          Sponsored: parking-friendly accommodation suggestions.
        </div>
      ) : null}

      {!hasConsent ? (
        <p className="mt-3 text-xs text-zinc-500">Affiliate modules stay disabled until consent is accepted.</p>
      ) : null}
    </section>
  );
}
