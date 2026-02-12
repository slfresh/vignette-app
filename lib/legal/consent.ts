export const CONSENT_KEY = "vignette_portal_cookie_consent_v1";
const CONSENT_EVENT = "vignette-consent-changed";

export type ConsentState = "accepted" | "rejected" | "unset";

export function readConsentFromStorage(): ConsentState {
  if (typeof window === "undefined") {
    return "unset";
  }
  const value = window.localStorage.getItem(CONSENT_KEY);
  if (value === "accepted" || value === "rejected") {
    return value;
  }
  return "unset";
}

export function writeConsentToStorage(state: Exclude<ConsentState, "unset">): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONSENT_KEY, state);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function subscribeConsentChange(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY) {
      onStoreChange();
    }
  };

  const onCustomEvent = () => {
    onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CONSENT_EVENT, onCustomEvent);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONSENT_EVENT, onCustomEvent);
  };
}
