/**
 * In-process sliding-window rate limiter.
 * Resets on server restart — acceptable for single-instance / prototype use.
 * Upgrade path: swap implementation for @upstash/ratelimit when moving to edge/serverless.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms when the window expires
}

const LIMIT = 5;           // max requests per window
const WINDOW_MS = 60_000;  // 60-second window

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether the given IP has exceeded the rate limit.
 * @param ip - the caller's IP address (falls back to "unknown")
 * @returns { limited: true, retryAfter: N } when over limit, else { limited: false, retryAfter: 0 }
 */
export function checkRateLimit(ip: string): { limited: boolean; retryAfter: number } {
  const key = ip || "unknown";
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // first request in this window (or window has expired)
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfter: 0 };
  }

  if (entry.count >= LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  entry.count++;
  return { limited: false, retryAfter: 0 };
}
