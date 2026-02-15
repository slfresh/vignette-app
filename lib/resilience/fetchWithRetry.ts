import { logger } from "@/lib/logging/logger";

/**
 * Wraps `fetch` with retry logic and basic circuit-breaker behavior.
 *
 * - Retries transient errors (5xx, network failures) up to `maxRetries` times
 * - Uses exponential backoff between retries (200ms, 400ms, 800ms…)
 * - Tracks consecutive failures per host; if a host fails more than
 *   `circuitThreshold` times in a row, future requests fail immediately
 *   for `circuitCooldownMs` (default 30s) to avoid hammering a broken service.
 * - Non-retryable errors (4xx) are returned immediately.
 */

/** How many consecutive failures before the circuit "opens" for a host. */
const CIRCUIT_THRESHOLD = 5;

/** How long (ms) the circuit stays open before allowing a retry. */
const CIRCUIT_COOLDOWN_MS = 30_000;

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

/** Per-host circuit breaker state. */
const circuits = new Map<string, CircuitState>();

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function getCircuit(host: string): CircuitState {
  let state = circuits.get(host);
  if (!state) {
    state = { failures: 0, openedAt: null };
    circuits.set(host, state);
  }
  return state;
}

/** Check whether the circuit breaker is currently open for a host. */
function isCircuitOpen(host: string): boolean {
  const state = getCircuit(host);
  if (state.openedAt === null) return false;
  // Check if cooldown has elapsed
  if (Date.now() - state.openedAt >= CIRCUIT_COOLDOWN_MS) {
    // Half-open: allow one request through
    state.openedAt = null;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordSuccess(host: string): void {
  const state = getCircuit(host);
  state.failures = 0;
  state.openedAt = null;
}

function recordFailure(host: string): void {
  const state = getCircuit(host);
  state.failures += 1;
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.openedAt = Date.now();
    logger.warn("Circuit breaker opened", { host, failures: state.failures });
  }
}

/** Returns true if the HTTP status is a transient server error worth retrying. */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

interface FetchWithRetryOptions {
  /** Maximum number of retry attempts (default: 2, meaning up to 3 total requests). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 200). */
  baseDelayMs?: number;
  /** Timeout in ms for each individual attempt (default: 10000). */
  timeoutMs?: number;
}

/**
 * Fetch with automatic retry on transient failures.
 *
 * @param url - The URL to fetch
 * @param init - Standard fetch RequestInit options
 * @param options - Retry and timeout configuration
 * @returns The Response from a successful attempt
 * @throws Error if all attempts fail or circuit is open
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<Response> {
  const { maxRetries = 2, baseDelayMs = 200, timeoutMs = 10_000 } = options ?? {};
  const host = getHost(url);

  // Circuit breaker check
  if (isCircuitOpen(host)) {
    throw new Error(`Circuit breaker open for ${host}. Service is temporarily unavailable.`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a per-attempt timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Merge the timeout signal with any existing signal
      const mergedInit: RequestInit = {
        ...init,
        signal: controller.signal,
      };

      const response = await fetch(url, mergedInit).finally(() => clearTimeout(timeoutId));

      // Non-retryable status: return immediately
      if (response.ok || !isRetryableStatus(response.status)) {
        recordSuccess(host);
        return response;
      }

      // Retryable status: log and retry if attempts remain
      lastError = new Error(`HTTP ${response.status} from ${host}`);
      recordFailure(host);

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.debug("Retrying fetch", { url, attempt: attempt + 1, delayMs, status: response.status });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        // All retries exhausted — return the last response so caller can handle it
        return response;
      }
    } catch (error) {
      // Network error or timeout
      lastError = error instanceof Error ? error : new Error(String(error));
      recordFailure(host);

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`Request to ${host} timed out after ${timeoutMs}ms`);
      }

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.debug("Retrying after error", { url, attempt: attempt + 1, delayMs, error: lastError.message });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error(`All ${maxRetries + 1} attempts failed for ${url}`);
}
