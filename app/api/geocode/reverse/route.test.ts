import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { checkRateLimit } from "@/lib/security/rateLimit";

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

describe("GET /api/geocode/reverse", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 400 for invalid coordinates", async () => {
    const request = new Request("http://localhost/api/geocode/reverse?lat=not-a-number&lon=11.5");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 10 });
    const request = new Request("http://localhost/api/geocode/reverse?lat=48.1&lon=11.5");
    const response = await GET(request);
    expect(response.status).toBe(429);
  });
});
