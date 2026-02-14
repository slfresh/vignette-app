/**
 * Lightweight structured JSON logger for API routes.
 *
 * Outputs one JSON object per line (NDJSON) so logs are easy to parse,
 * search, and alert on in production log aggregators (e.g. Loki, Datadog).
 *
 * Usage:
 *   import { logger } from "@/lib/logging/logger";
 *   logger.info("Route analysis started", { requestId, from, to });
 *   logger.warn("Rate limit hit", { ip, scope });
 *   logger.error("ORS request failed", { status: 502, duration: 1234 });
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => emit("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => emit("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => emit("error", message, data),
};
