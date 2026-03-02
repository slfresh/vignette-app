"use client";

import { readConsentFromStorage, subscribeConsentChange, writeConsentToStorage } from "@/lib/legal/consent";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export function ConsentBanner() {
  const { t } = useI18n();
  const consent = useSyncExternalStore(subscribeConsentChange, readConsentFromStorage, () => "unset");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (consent === "unset") {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [consent]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (consent !== "unset") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const firstButton = dialog.querySelector<HTMLElement>("button");
    firstButton?.focus();

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [consent, handleKeyDown]);

  if (consent !== "unset") {
    return null;
  }

  function accept() {
    writeConsentToStorage("accepted");
    previousFocusRef.current?.focus();
  }

  function reject() {
    writeConsentToStorage("rejected");
    previousFocusRef.current?.focus();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      aria-describedby="consent-description"
      className="fixed right-4 bottom-24 z-50 max-w-sm rounded-xl border border-[var(--border-strong)] bg-surface p-4 shadow-lg sm:max-w-md"
    >
      <p id="consent-title" className="text-sm font-medium text-[var(--text-primary)]">
        {t("consent.title")}
      </p>
      <p id="consent-description" className="mt-1 text-xs text-[var(--text-secondary)]">
        {t("consent.description")}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={accept}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          {t("consent.accept")}
        </button>
        <button
          onClick={reject}
          className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-[var(--border-strong)] focus:ring-offset-2"
        >
          {t("consent.reject")}
        </button>
      </div>
    </div>
  );
}
