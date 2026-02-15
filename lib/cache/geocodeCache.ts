/**
 * LRU cache for geocoding results.
 *
 * Avoids redundant calls to ORS / Photon / Nominatim for the same query.
 * Cache entries expire after TTL_MS to keep data reasonably fresh.
 * Uses LRU (Least Recently Used) eviction: accessing a key moves it to
 * the back of the eviction queue, so popular entries stay cached longer.
 *
 * Note: This cache lives in the Node.js process. In a multi-instance
 * deployment each instance keeps its own copy, which is acceptable
 * for a read-heavy, low-write geocoding workload.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Default time-to-live: 10 minutes. Addresses rarely change. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Maximum entries to prevent unbounded memory growth. */
const MAX_ENTRIES = 2_000;

class LruCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Retrieve a cached value, or undefined if missing / expired.
   * Accessing a key promotes it to "most recently used" (LRU behavior).
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      // Entry expired — remove it and return undefined
      this.store.delete(key);
      return undefined;
    }
    // LRU promotion: delete and re-insert so it moves to the end of the Map
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /** Store a value with the configured TTL. */
  set(key: string, value: T): void {
    // If the key already exists, delete it first so re-insert moves it to the end
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    // Evict the least-recently-used entry (first in Map iteration order)
    if (this.store.size >= MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Number of entries currently stored (including possibly expired). */
  get size(): number {
    return this.store.size;
  }

  /** Remove all entries. Useful for testing. */
  clear(): void {
    this.store.clear();
  }
}

/** Cache for geocode suggest results (keyed by query string). */
export const geocodeSuggestCache = new LruCache<
  Array<{ label: string; lat: number; lon: number }>
>(DEFAULT_TTL_MS);

/** Cache for single-address geocoding (keyed by address string). */
export const geocodeAddressCache = new LruCache<{
  lat: number;
  lon: number;
}>(DEFAULT_TTL_MS);

/** Export the class for testing purposes. */
export { LruCache };
