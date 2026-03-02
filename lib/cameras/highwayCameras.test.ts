import { describe, it, expect } from "vitest";
import { getAllHighwayCameras, getHighwayCamerasByRoute } from "@/lib/cameras/highwayCameras";

describe("getAllHighwayCameras", () => {
  const cameras = getAllHighwayCameras();

  it("returns more than 40 cameras", () => {
    expect(cameras.length).toBeGreaterThan(40);
  });

  it("each camera has id, label, highway, lat, lon, url", () => {
    for (const cam of cameras) {
      expect(typeof cam.id).toBe("number");
      expect(typeof cam.label).toBe("string");
      expect(typeof cam.highway).toBe("string");
      expect(typeof cam.lat).toBe("number");
      expect(typeof cam.lon).toBe("number");
      expect(typeof cam.url).toBe("string");
    }
  });
});

describe("getHighwayCamerasByRoute", () => {
  it('returns only A1 cameras for "A1"', () => {
    const cameras = getHighwayCamerasByRoute("A1");
    expect(cameras.length).toBeGreaterThan(0);
    for (const cam of cameras) {
      expect(cam.highway).toBe("A1");
    }
  });

  it("is case-insensitive", () => {
    const upper = getHighwayCamerasByRoute("A1");
    const lower = getHighwayCamerasByRoute("a1");
    expect(lower.length).toBe(upper.length);
  });

  it("returns empty for a non-existent highway", () => {
    const cameras = getHighwayCamerasByRoute("X99");
    expect(cameras).toEqual([]);
  });
});
