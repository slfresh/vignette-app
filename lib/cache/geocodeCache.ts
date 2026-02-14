/**
 * Simple in-memory cache for geocoding results.
 *
 * Avoids redundant calls to ORS / Photon / Nominatim for the same query.
 * Cache entries expire after TTL_MS to keep data reasonably fresh.
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

class SimpleCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /** Retrieve a cached value, or undefined if missing / expired. */
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
    return entry.value;
  }

  /** Store a value with the configured TTL. */
  set(key: string, value: T): void {
    // Evict oldest entries when approaching the limit
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
}

/** Cache for geocode suggest results (keyed by query string). */
export const geocodeSuggestCache = new SimpleCache<
  Array<{ label: string; lat: number; lon: number }>
>(DEFAULT_TTL_MS);

/** Cache for single-address geocoding (keyed by address string). */
export const geocodeAddressCache = new SimpleCache<{
  lat: number;
  lon: number;
}>(DEFAULT_TTL_MS);
