import { Redis } from "@upstash/redis";

const LIMIT = 10; // requests
const WINDOW_SEC = 60; // per minute, per IP
const DAILY_CAP = Number(process.env.EXTRACT_DAILY_CAP) || 1000; // all users, per UTC day

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// In-memory fallback (per serverless instance; best effort only).
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, now: number): number {
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_SEC * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export { clientIp } from "@/lib/ip";

/** Returns true if the request is allowed. Fails open if Redis errors. */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const now = Date.now();
  const window = Math.floor(now / (WINDOW_SEC * 1000));
  const key = `rl:extract:${ip}:${window}`;
  const r = getRedis();
  if (r) {
    try {
      // Global daily cap protects API spend even if per-IP limits are evaded.
      const dayKey = `rl:extract:day:${Math.floor(now / 86_400_000)}`;
      const day = await r.incr(dayKey);
      if (day === 1) await r.expire(dayKey, 90_000);
      if (day > DAILY_CAP) return false;
      const count = await r.incr(key);
      if (count === 1) await r.expire(key, WINDOW_SEC + 5);
      return count <= LIMIT;
    } catch {
      // fall through to in-memory limiter
    }
  }
  return memoryHit(key, now) <= LIMIT;
}
