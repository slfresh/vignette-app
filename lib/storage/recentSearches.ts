const STORAGE_KEY = "eurodrive_recent_searches";
const MAX_ITEMS = 5;

export interface RecentSearch {
  label: string;
  lat: number;
  lon: number;
  timestamp: number;
}

export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearch =>
          typeof item === "object" &&
          item !== null &&
          typeof item.label === "string" &&
          typeof item.lat === "number" &&
          typeof item.lon === "number" &&
          typeof item.timestamp === "number",
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function addRecentSearch(entry: Omit<RecentSearch, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentSearches();
    const deduped = existing.filter(
      (item) => !(item.label === entry.label && item.lat === entry.lat && item.lon === entry.lon),
    );
    const updated: RecentSearch[] = [
      { ...entry, timestamp: Date.now() },
      ...deduped,
    ].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or disabled
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
