import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { checkRateLimit } from "@/lib/security/rateLimit";

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

describe("GET /api/geocode/suggest", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns empty suggestions for short query", async () => {
    const request = new Request("http://localhost/api/geocode/suggest?q=a");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.suggestions).toEqual([]);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 15 });
    const request = new Request("http://localhost/api/geocode/suggest?q=Munich");
    const response = await GET(request);
    expect(response.status).toBe(429);
  });
});
