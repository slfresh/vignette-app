import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  CONSENT_KEY,
  readConsentFromStorage,
  writeConsentToStorage,
  subscribeConsentChange,
} from "@/lib/legal/consent";

// ---------------------------------------------------------------------------
// localStorage + window event mock
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

const listeners: Record<string, Set<Function>> = {};

const addEventListenerMock = vi.fn(
  (event: string, handler: Function) => {
    (listeners[event] ??= new Set()).add(handler);
  },
);
const removeEventListenerMock = vi.fn(
  (event: string, handler: Function) => {
    listeners[event]?.delete(handler);
  },
);
const dispatchEventMock = vi.fn((event: Event) => {
  listeners[event.type]?.forEach((handler) => handler(event));
  return true;
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  writable: true,
  configurable: true,
});

// Attach event helpers to globalThis (which is our "window")
globalThis.addEventListener = addEventListenerMock as unknown as typeof globalThis.addEventListener;
globalThis.removeEventListener = removeEventListenerMock as unknown as typeof globalThis.removeEventListener;
globalThis.dispatchEvent = dispatchEventMock as unknown as typeof globalThis.dispatchEvent;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetStore() {
  for (const key of Object.keys(store)) delete store[key];
  for (const key of Object.keys(listeners)) delete listeners[key];
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  addEventListenerMock.mockClear();
  removeEventListenerMock.mockClear();
  dispatchEventMock.mockClear();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("consent", () => {
  beforeEach(() => {
    resetStore();
  });

  // ── readConsentFromStorage ─────────────────────────────────────────────

  describe("readConsentFromStorage", () => {
    it('returns "unset" when nothing is stored', () => {
      expect(readConsentFromStorage()).toBe("unset");
    });

    it('returns "accepted" when stored value is "accepted"', () => {
      store[CONSENT_KEY] = "accepted";
      expect(readConsentFromStorage()).toBe("accepted");
    });

    it('returns "rejected" when stored value is "rejected"', () => {
      store[CONSENT_KEY] = "rejected";
      expect(readConsentFromStorage()).toBe("rejected");
    });

    it('returns "unset" for an invalid/unknown stored value', () => {
      store[CONSENT_KEY] = "maybe";
      expect(readConsentFromStorage()).toBe("unset");
    });

    it('returns "unset" on the server (window undefined)', () => {
      vi.stubGlobal("window", undefined);
      expect(readConsentFromStorage()).toBe("unset");
      vi.stubGlobal("window", globalThis);
    });
  });

  // ── writeConsentToStorage ──────────────────────────────────────────────

  describe("writeConsentToStorage", () => {
    it("saves the value to localStorage and dispatches an event", () => {
      writeConsentToStorage("accepted");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        CONSENT_KEY,
        "accepted",
      );
      expect(dispatchEventMock).toHaveBeenCalledTimes(1);
      expect(dispatchEventMock.mock.calls[0][0].type).toBe(
        "vignette-consent-changed",
      );
    });

    it("can write 'rejected' as well", () => {
      writeConsentToStorage("rejected");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        CONSENT_KEY,
        "rejected",
      );
    });
  });

  // ── subscribeConsentChange ─────────────────────────────────────────────

  describe("subscribeConsentChange", () => {
    it("registers both storage and custom event listeners", () => {
      const callback = vi.fn();
      subscribeConsentChange(callback);

      expect(addEventListenerMock).toHaveBeenCalledWith(
        "storage",
        expect.any(Function),
      );
      expect(addEventListenerMock).toHaveBeenCalledWith(
        "vignette-consent-changed",
        expect.any(Function),
      );
    });

    it("calls callback when the custom consent event fires", () => {
      const callback = vi.fn();
      subscribeConsentChange(callback);

      dispatchEventMock(new Event("vignette-consent-changed"));

      expect(callback).toHaveBeenCalled();
    });

    it("unsubscribes both listeners when the returned function is called", () => {
      const callback = vi.fn();
      const unsubscribe = subscribeConsentChange(callback);

      unsubscribe();

      expect(removeEventListenerMock).toHaveBeenCalledWith(
        "storage",
        expect.any(Function),
      );
      expect(removeEventListenerMock).toHaveBeenCalledWith(
        "vignette-consent-changed",
        expect.any(Function),
      );
    });
  });
});
