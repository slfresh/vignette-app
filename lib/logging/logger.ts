/**
 * Structured JSON logger for API routes and server-side code.
 *
 * Outputs one JSON object per line (NDJSON) so logs are easy to parse,
 * search, and alert on in production log aggregators (e.g. Loki, Datadog).
 *
 * Features:
 * - Log level filtering via LOG_LEVEL env var (default: "info")
 * - Structured context (requestId, duration, etc.)
 * - Error stack trace extraction
 * - Performance timing helper
 *
 * Usage:
 *   import { logger } from "@/lib/logging/logger";
 *   logger.info("Route analysis started", { requestId, from, to });
 *   logger.warn("Rate limit hit", { ip, scope });
 *   logger.error("ORS request failed", { status: 502, duration: 1234 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/** Numeric priorities for level comparison (higher = more severe). */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Returns the minimum log level from the LOG_LEVEL env var.
 * Falls back to "info" if not set or invalid.
 */
function getMinLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (envLevel in LEVEL_PRIORITY) {
    return envLevel as LogLevel;
  }
  return "info";
}

/**
 * Extracts a clean stack trace string from an Error, removing the first
 * line (which duplicates the message) and limiting depth for readability.
 */
function extractStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    const lines = error.stack.split("\n").slice(1, 6); // Up to 5 stack frames
    return lines.map((line) => line.trim()).join(" <- ");
  }
  return undefined;
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  // Skip if below minimum log level
  const minLevel = getMinLevel();
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // If an "error" field is an Error object, extract useful info
  if (data?.error instanceof Error) {
    entry.errorMessage = data.error.message;
    entry.stack = extractStack(data.error);
    delete entry.error; // Remove the raw Error object (not JSON-serializable)
  }

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => emit("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) => emit("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => emit("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => emit("error", message, data),

  /**
   * Creates a timer that logs duration when `.end()` is called.
   * Useful for measuring API call or route analysis performance.
   *
   * @example
   *   const timer = logger.time("geocode");
   *   const result = await geocode(query);
   *   timer.end({ query }); // logs: "geocode completed" with durationMs
   */
  time: (label: string) => {
    const startMs = Date.now();
    return {
      end: (data?: Record<string, unknown>) => {
        const durationMs = Date.now() - startMs;
        emit("info", `${label} completed`, { ...data, durationMs });
      },
    };
  },
};
