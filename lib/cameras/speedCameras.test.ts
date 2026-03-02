import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LUFOP_COUNTRIES,
  fetchSpeedCameras,
  fetchSpeedCamerasAlongRoute,
} from "@/lib/cameras/speedCameras";

vi.mock("@/lib/logging/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockLufopEntry = {
  ID: "123",
  name: "Camera 1",
  lat: 48.0,
  lng: 11.0,
  type: "fixed",
  commune: "Munich",
  voie: "A8",
  flash: "D",
  azimut: "90",
  update: "2026-01-01",
  vitesse: "120",
};

const mockLufopEntry2 = {
  ID: "456",
  name: "Camera 2",
  lat: 49.0,
  lng: 12.0,
  type: "mobile",
  commune: "Nuremberg",
  voie: "A3",
  flash: "B",
  azimut: "180",
  update: "2026-02-01",
  vitesse: "100",
};

describe("speedCameras", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("LUFOP_COUNTRIES", () => {
    it("is a non-empty array of country codes", () => {
      expect(Array.isArray(LUFOP_COUNTRIES)).toBe(true);
      expect(LUFOP_COUNTRIES.length).toBeGreaterThan(0);
    });

    it("contains expected countries like 'fr' and 'de'", () => {
      expect(LUFOP_COUNTRIES).toContain("fr");
      expect(LUFOP_COUNTRIES).toContain("de");
    });
  });

  describe("fetchSpeedCameras", () => {
    it("returns empty array when LUFOP_API_KEY is not set", async () => {
      vi.stubEnv("LUFOP_API_KEY", "");

      const result = await fetchSpeedCameras({ lat: 48.0, lon: 11.0 });

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns parsed cameras on success", async () => {
      vi.stubEnv("LUFOP_API_KEY", "test-lufop-key");

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify([mockLufopEntry]), { status: 200 }),
      );

      const cameras = await fetchSpeedCameras({ lat: 48.0, lon: 11.0 });

      expect(cameras).toHaveLength(1);
      expect(cameras[0]).toMatchObject({
        id: "123",
        name: "Camera 1",
        lat: 48.0,
        lon: 11.0,
        type: "fixed",
        city: "Munich",
        road: "A8",
        flashDirection: "D",
        azimuth: 90,
        speedLimit: 120,
        updatedAt: "2026-01-01",
      });
    });

    it("returns empty array on API error (non-200)", async () => {
      vi.stubEnv("LUFOP_API_KEY", "test-lufop-key");

      mockFetch.mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 }),
      );

      const result = await fetchSpeedCameras({ lat: 48.0, lon: 11.0 });

      expect(result).toEqual([]);
    });

    it("returns empty array on fetch timeout", async () => {
      vi.stubEnv("LUFOP_API_KEY", "test-lufop-key");

      const abortError = new DOMException("The operation was aborted.", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchSpeedCameras({ lat: 48.0, lon: 11.0 });

      expect(result).toEqual([]);
    });
  });

  describe("fetchSpeedCamerasAlongRoute", () => {
    it("returns empty array for empty coordinates", async () => {
      const result = await fetchSpeedCamerasAlongRoute([]);

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("deduplicates cameras by ID", async () => {
      vi.stubEnv("LUFOP_API_KEY", "test-lufop-key");

      // Two route points close enough that each returns the same camera
      const duplicateEntries = [mockLufopEntry, mockLufopEntry2];
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(duplicateEntries), { status: 200 }),
      );

      // Route with start and end ~200km apart so we get 2+ sample points
      const routeCoords: [number, number][] = [
        [11.0, 48.0],
        [13.0, 48.5],
        [15.0, 49.0],
      ];

      const cameras = await fetchSpeedCamerasAlongRoute(routeCoords, 30);

      // Both fetches return entries with IDs "123" and "456",
      // but deduplication means each ID appears only once
      const ids = cameras.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });
});
