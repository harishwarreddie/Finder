// ── REDIS CACHE CLIENT ────────────────────────────────────────────────────────
// Upstash Redis — serverless-compatible, pay-per-request.
// All cache access goes through this singleton.

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.\n" +
        "Create a free database at https://console.upstash.com"
      );
    }

    redisInstance = new Redis({ url, token });
  }
  return redisInstance;
}

// ── TYPED CACHE OPERATIONS ────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get<T>(key);
    return value ?? null;
  } catch (err) {
    console.error(`Cache GET failed for key "${key}":`, err);
    return null; // Never throw — cache miss is always acceptable
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await getRedis().set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error(`Cache SET failed for key "${key}":`, err);
    // Never throw — cache failure is not a fatal error
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch (err) {
    console.error(`Cache DELETE failed for key "${key}":`, err);
  }
}

// ── CACHE-OR-FETCH HELPER ─────────────────────────────────────────────────────

/**
 * Returns cached value if present, otherwise calls fetcher, caches result, and returns it.
 * This is the primary pattern for all external API calls.
 *
 * @example
 * const availability = await cacheOrFetch(
 *   keys.availability(contentId, region),
 *   TTL.AVAILABILITY,
 *   () => watchmode.getSources(watchmodeId, region)
 * );
 */
export async function cacheOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
