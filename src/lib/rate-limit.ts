/**
 * In-memory sliding-window rate limiter.
 * Works per serverless instance — not globally distributed, but effective
 * against rapid automated attacks hitting the same instance.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
const MAX_STORE_SIZE = 5000;

function cleanup() {
  if (store.size <= MAX_STORE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

/**
 * Check if a request is allowed under the rate limit.
 * @param key    Unique key (e.g. "login:user@email.com" or "register:192.168.1.1")
 * @param max    Maximum attempts allowed in the window
 * @param windowMs  Window duration in milliseconds
 * @returns      { allowed, retryAfterSeconds }
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}
