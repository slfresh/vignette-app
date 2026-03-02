import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/logging/logger";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logger.info outputs JSON to console.log", () => {
    logger.info("hello world");

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.message).toBe("hello world");
  });

  it("logger.warn outputs to console.warn", () => {
    logger.warn("something off");

    expect(warnSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(output.message).toBe("something off");
  });

  it("logger.error outputs to console.error", () => {
    logger.error("failure");

    expect(errorSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(output.message).toBe("failure");
  });

  it("logger.debug is suppressed when LOG_LEVEL defaults to info", () => {
    logger.debug("this should be hidden");

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("logger.debug outputs when LOG_LEVEL is debug", () => {
    vi.stubEnv("LOG_LEVEL", "debug");

    logger.debug("visible now");

    expect(debugSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(debugSpy.mock.calls[0][0] as string);
    expect(output.message).toBe("visible now");
  });

  it("output contains level, message, and timestamp", () => {
    logger.info("structured entry", { extra: "data" });

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.level).toBe("info");
    expect(output.message).toBe("structured entry");
    expect(output.timestamp).toBeDefined();
    expect(output.extra).toBe("data");
    // Timestamp should be a valid ISO string
    expect(() => new Date(output.timestamp).toISOString()).not.toThrow();
  });

  it("extracts errorMessage and stack from Error objects", () => {
    const testError = new Error("boom");
    logger.error("something broke", { error: testError });

    const output = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(output.errorMessage).toBe("boom");
    expect(output.stack).toBeDefined();
    expect(typeof output.stack).toBe("string");
    // Raw error should be removed (not JSON-serializable)
    expect(output.error).toBeUndefined();
  });

  it("logger.time measures duration and logs on .end()", () => {
    const timer = logger.time("geocode");

    timer.end({ query: "Munich" });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.message).toBe("geocode completed");
    expect(output.query).toBe("Munich");
    expect(typeof output.durationMs).toBe("number");
    expect(output.durationMs).toBeGreaterThanOrEqual(0);
  });
});
