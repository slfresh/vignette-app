import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeoutSignal, geocodeAddress, resolveLocation } from "@/lib/geocoding/geocode";

vi.mock("@/lib/cache/geocodeCache", () => ({
  geocodeAddressCache: { get: vi.fn(() => null), set: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function geoJsonResponse(lon: number, lat: number): Response {
  return new Response(
    JSON.stringify({
      features: [{ geometry: { coordinates: [lon, lat] } }],
    }),
    { status: 200 },
  );
}

function nominatimResponse(lat: number, lon: number): Response {
  return new Response(
    JSON.stringify([{ lat: String(lat), lon: String(lon) }]),
    { status: 200 },
  );
}

describe("geocode – extended tests", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("timeoutSignal", () => {
    it("returns an object with signal and clear function", () => {
      const result = timeoutSignal(5000);

      expect(result.signal).toBeDefined();
      expect(result.signal).toBeInstanceOf(AbortSignal);
      expect(typeof result.clear).toBe("function");
    });

    it("signal is not aborted immediately", () => {
      const result = timeoutSignal(5000);

      expect(result.signal.aborted).toBe(false);
      result.clear();
    });

    it("clear function can be called without error", () => {
      const result = timeoutSignal(5000);

      expect(() => result.clear()).not.toThrow();
    });
  });

  describe("geocodeAddress", () => {
    it("uses ORS as primary provider when API key is set", async () => {
      vi.stubEnv("ORS_API_KEY", "test-ors-key");
      mockFetch.mockResolvedValueOnce(geoJsonResponse(11.575, 48.137));

      const point = await geocodeAddress("Munich");

      expect(point).toEqual({ lon: 11.575, lat: 48.137 });
      expect(mockFetch).toHaveBeenCalledOnce();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("openrouteservice.org");
    });

    it("falls back to Photon when ORS fails", async () => {
      vi.stubEnv("ORS_API_KEY", "test-ors-key");

      // ORS fails
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
      // Photon succeeds
      mockFetch.mockResolvedValueOnce(geoJsonResponse(11.575, 48.137));

      const point = await geocodeAddress("Munich");

      expect(point).toEqual({ lon: 11.575, lat: 48.137 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("falls back to Nominatim when both ORS and Photon fail", async () => {
      vi.stubEnv("ORS_API_KEY", "test-ors-key");

      // ORS fails
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
      // Photon fails
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
      // Nominatim succeeds
      mockFetch.mockResolvedValueOnce(nominatimResponse(48.137, 11.575));

      const point = await geocodeAddress("Munich");

      expect(point).toEqual({ lat: 48.137, lon: 11.575 });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("skips ORS when no API key is set and uses Photon", async () => {
      vi.stubEnv("ORS_API_KEY", "");

      mockFetch.mockResolvedValueOnce(geoJsonResponse(11.575, 48.137));

      const point = await geocodeAddress("Munich");

      expect(point).toEqual({ lon: 11.575, lat: 48.137 });
      expect(mockFetch).toHaveBeenCalledOnce();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("photon.komoot.io");
    });

    it("throws when all providers fail", async () => {
      vi.stubEnv("ORS_API_KEY", "test-ors-key");

      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));
      mockFetch.mockResolvedValueOnce(new Response("error", { status: 500 }));

      await expect(geocodeAddress("Nonexistent Place XYZ")).rejects.toThrow(
        /Could not resolve/,
      );
    });
  });

  describe("resolveLocation", () => {
    it('parses coordinate string "48.137, 11.575" directly without fetching', async () => {
      const point = await resolveLocation("48.137, 11.575");

      expect(point).toEqual({ lat: 48.137, lon: 11.575 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("geocodes a place name like 'Munich'", async () => {
      vi.stubEnv("ORS_API_KEY", "");

      mockFetch.mockResolvedValueOnce(geoJsonResponse(11.575, 48.137));

      const point = await resolveLocation("Munich");

      expect(point).toEqual({ lon: 11.575, lat: 48.137 });
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
