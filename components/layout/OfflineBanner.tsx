"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a banner when the user loses internet connectivity.
 * Automatically hides when connection is restored.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      <WifiOff className="h-4 w-4" />
      You are offline. Route calculations require an internet connection.
    </div>
  );
}
