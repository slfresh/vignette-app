import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_STORE = new Map<string, RateLimitBucket>();
const REDIS_LIMITERS = new Map<string, Ratelimit>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

function cleanupExpiredBuckets(now: number): void {
  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (bucket.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

function checkRateLimitInMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const current = RATE_LIMIT_STORE.get(key);

  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

function getRedisLimiter(scope: string, maxRequests: number, windowMs: number): Ratelimit | null {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) {
    return null;
  }

  const cacheKey = `${scope}:${maxRequests}:${windowMs}`;
  const cached = REDIS_LIMITERS.get(cacheKey);
  if (cached) {
    return cached;
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(maxRequests, `${seconds} s`),
    prefix: `ratelimit:${scope}`,
  });
  REDIS_LIMITERS.set(cacheKey, limiter);
  return limiter;
}

async function checkRateLimitInRedis(
  key: string,
  limiter: Ratelimit,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const result = await limiter.limit(key);
  if (result.success) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return { allowed: false, retryAfterSeconds };
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const ip = getClientIp(request);
  const key = `${scope}:${ip}`;
  const redisLimiter = getRedisLimiter(scope, maxRequests, windowMs);

  if (!redisLimiter) {
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }

  try {
    return await checkRateLimitInRedis(key, redisLimiter);
  } catch {
    // If Redis is temporarily unavailable, fail open to avoid blocking all users.
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }
}

export function resetRateLimitStoreForTests(): void {
  RATE_LIMIT_STORE.clear();
}
