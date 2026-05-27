import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { checkRateLimit } from "@/lib/security/rateLimit";

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

describe("POST /api/route-analysis", () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const request = new Request("http://localhost/api/route-analysis", {
      method: "POST",
      body: JSON.stringify({ start: "Munich", end: "Vienna" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/route-analysis", {
      method: "POST",
      body: "{bad json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_JSON");
  });

  it("returns 400 for validation errors", async () => {
    const request = new Request("http://localhost/api/route-analysis", {
      method: "POST",
      body: JSON.stringify({ start: "", end: "Vienna" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 413 for oversized payload", async () => {
    const request = new Request("http://localhost/api/route-analysis", {
      method: "POST",
      body: "x".repeat(11_000),
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
  });

  it("returns 500 when ORS_API_KEY is missing", async () => {
    const original = process.env.ORS_API_KEY;
    delete process.env.ORS_API_KEY;
    const request = new Request("http://localhost/api/route-analysis", {
      method: "POST",
      body: JSON.stringify({ start: "Munich", end: "Vienna" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("MISSING_API_KEY");
    process.env.ORS_API_KEY = original;
  });
});
