import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTrafficFlowTileUrl,
  getTrafficIncidentTileUrl,
  fetchTrafficIncidents,
} from "@/lib/traffic/tomtom";

vi.mock("@/lib/logging/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("tomtom", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("getTrafficFlowTileUrl", () => {
    it("returns correct URL with default style 'relative'", () => {
      const url = getTrafficFlowTileUrl("MY_KEY");

      expect(url).toBe(
        "https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=MY_KEY&tileSize=256",
      );
    });

    it("returns correct URL with custom style", () => {
      const url = getTrafficFlowTileUrl("MY_KEY", "absolute");

      expect(url).toBe(
        "https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=MY_KEY&tileSize=256",
      );
    });
  });

  describe("getTrafficIncidentTileUrl", () => {
    it("returns correct URL", () => {
      const url = getTrafficIncidentTileUrl("MY_KEY");

      expect(url).toBe(
        "https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=MY_KEY&tileSize=256",
      );
    });
  });

  describe("fetchTrafficIncidents", () => {
    it("returns empty array when TOMTOM_API_KEY is not set", async () => {
      vi.stubEnv("TOMTOM_API_KEY", "");

      const result = await fetchTrafficIncidents({ lat: 48.137, lon: 11.575 });

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns parsed incidents on success", async () => {
      vi.stubEnv("TOMTOM_API_KEY", "test-key");

      const tomtomResponse = {
        incidents: [
          {
            type: "CONSTRUCTION",
            geometry: { type: "Point", coordinates: [11.575, 48.137] },
            properties: {
              id: "inc-1",
              magnitudeOfDelay: 2,
              events: [{ description: "Road construction", code: 100 }],
              from: "A8 km 10",
              to: "A8 km 20",
              roadNumbers: ["A8"],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(tomtomResponse), { status: 200 }),
      );

      const incidents = await fetchTrafficIncidents({ lat: 48.137, lon: 11.575 });

      expect(incidents).toHaveLength(1);
      expect(incidents[0]).toMatchObject({
        id: "inc-1",
        type: "CONSTRUCTION",
        severity: "moderate",
        description: "Road construction",
        lat: 48.137,
        lon: 11.575,
        from: "A8 km 10",
        to: "A8 km 20",
        roadName: "A8",
      });
    });

    it("returns empty array on API error (non-200)", async () => {
      vi.stubEnv("TOMTOM_API_KEY", "test-key");

      mockFetch.mockResolvedValueOnce(
        new Response("Service Unavailable", { status: 503 }),
      );

      const result = await fetchTrafficIncidents({ lat: 48.137, lon: 11.575 });

      expect(result).toEqual([]);
    });

    it("returns empty array on timeout (AbortError)", async () => {
      vi.stubEnv("TOMTOM_API_KEY", "test-key");

      const abortError = new DOMException("The operation was aborted.", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchTrafficIncidents({ lat: 48.137, lon: 11.575 });

      expect(result).toEqual([]);
    });
  });
});
