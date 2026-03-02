import { describe, it, expect, vi, beforeEach } from "vitest";

const STORAGE_KEY = "eurodrive_recent_searches";

// ---------------------------------------------------------------------------
// localStorage mock – runs before the module under test is imported
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

import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  type RecentSearch,
} from "@/lib/storage/recentSearches";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetStore() {
  for (const key of Object.keys(store)) delete store[key];
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
}

function seedStore(entries: RecentSearch[]) {
  store[STORAGE_KEY] = JSON.stringify(entries);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("recentSearches", () => {
  beforeEach(() => {
    resetStore();
  });

  // ── getRecentSearches ──────────────────────────────────────────────────

  describe("getRecentSearches", () => {
    it("returns an empty array when nothing is stored", () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it("returns an empty array on the server (window undefined)", () => {
      vi.stubGlobal("window", undefined);
      expect(getRecentSearches()).toEqual([]);
      vi.stubGlobal("window", globalThis);
    });

    it("parses valid entries and filters out invalid ones", () => {
      const valid: RecentSearch = {
        label: "Vienna",
        lat: 48.2,
        lon: 16.37,
        timestamp: 1000,
      };
      const invalid = { label: "Bad", lat: "not-a-number", lon: 10 };

      store[STORAGE_KEY] = JSON.stringify([valid, invalid]);

      const result = getRecentSearches();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(valid);
    });

    it("sorts entries by timestamp descending", () => {
      seedStore([
        { label: "A", lat: 1, lon: 1, timestamp: 100 },
        { label: "C", lat: 3, lon: 3, timestamp: 300 },
        { label: "B", lat: 2, lon: 2, timestamp: 200 },
      ]);

      const labels = getRecentSearches().map((s) => s.label);
      expect(labels).toEqual(["C", "B", "A"]);
    });

    it("caps results at 5 items", () => {
      const entries: RecentSearch[] = Array.from({ length: 8 }, (_, i) => ({
        label: `City ${i}`,
        lat: i,
        lon: i,
        timestamp: i,
      }));
      seedStore(entries);

      expect(getRecentSearches()).toHaveLength(5);
    });

    it("handles corrupted JSON gracefully", () => {
      store[STORAGE_KEY] = "{{not valid json!!";
      expect(getRecentSearches()).toEqual([]);
    });

    it("returns empty array when stored value is not an array", () => {
      store[STORAGE_KEY] = JSON.stringify({ not: "an-array" });
      expect(getRecentSearches()).toEqual([]);
    });
  });

  // ── addRecentSearch ────────────────────────────────────────────────────

  describe("addRecentSearch", () => {
    it("adds an entry with a timestamp and deduplicates", () => {
      const entry = { label: "Vienna", lat: 48.2, lon: 16.37 };
      const now = 1_700_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      addRecentSearch(entry);
      addRecentSearch(entry); // duplicate

      const result = getRecentSearches();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ ...entry, timestamp: now });

      vi.restoreAllMocks();
    });

    it("keeps a maximum of 5 items", () => {
      for (let i = 0; i < 7; i++) {
        addRecentSearch({ label: `City ${i}`, lat: i, lon: i });
      }

      expect(getRecentSearches().length).toBeLessThanOrEqual(5);
    });
  });

  // ── clearRecentSearches ────────────────────────────────────────────────

  describe("clearRecentSearches", () => {
    it("removes the storage key", () => {
      seedStore([{ label: "X", lat: 0, lon: 0, timestamp: 1 }]);

      clearRecentSearches();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(getRecentSearches()).toEqual([]);
    });
  });
});
