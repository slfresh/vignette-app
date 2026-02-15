"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Subscribes to browser online/offline events and returns current status.
 * Uses useSyncExternalStore to avoid the set-state-in-effect pattern.
 */
function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

/** Server snapshot – assume online during SSR. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Shows a banner when the user loses internet connectivity.
 * Automatically hides when connection is restored.
 * Uses safe-area-inset for mobile browser compatibility.
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const isOnline = useSyncExternalStore(subscribeOnlineStatus, getOnlineSnapshot, getServerSnapshot);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="safe-bottom fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      <WifiOff className="h-4 w-4" />
      {t("offline.message")}
    </div>
  );
}
