"use client";

import { readConsentFromStorage, subscribeConsentChange, writeConsentToStorage } from "@/lib/legal/consent";
import { useSyncExternalStore } from "react";

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsentChange, readConsentFromStorage, () => "unset");

  if (consent !== "unset") {
    return null;
  }

  function accept() {
    writeConsentToStorage("accepted");
  }

  function reject() {
    writeConsentToStorage("rejected");
  }

  return (
    <aside className="fixed right-4 bottom-4 z-50 max-w-md rounded-xl border border-zinc-300 bg-white p-4 shadow-lg">
      <p className="text-sm font-medium text-zinc-900">Cookie consent</p>
      <p className="mt-1 text-xs text-zinc-700">
        We only load optional affiliate or analytics tracking after consent, as required by TDDDG.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={accept} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">
          Accept
        </button>
        <button onClick={reject} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800">
          Reject
        </button>
      </div>
    </aside>
  );
}
