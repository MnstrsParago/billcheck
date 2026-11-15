/**
 * SERVER-ONLY. Shared outcomes DB on Upstash Redis (REST).
 * Never import this from a client component (use lib/outcomes/client.ts).
 *
 * Redis layout:
 *   outcomes                  HASH  id -> OutcomeRecord JSON   (id = `${disputeId}:${lineId}`, demo ids `demo~...`)
 *   outcomes:seeded:v1        STRING "1" once demo rows are written
 *   outcomes:rl:<iphash>:<w>  STRING counter, per-IP POST rate limit window (EXPIRE)
 */
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import type { OutcomeRecord } from "@/lib/types";
import { generateDemoOutcomes } from "./demo-seed";
import { storedRecordSchema } from "./schema";

const HASH_KEY = "outcomes";
const SEED_KEY = "outcomes:seeded:v1";
const CACHE_TTL_MS = 45_000;
const RL_WINDOW_S = 600;
const RL_MAX = 30;

export class OutcomesNotConfiguredError extends Error {
  constructor() {
    super("Outcomes database is not configured");
  }
}

let client: Redis | null | undefined;

function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export function isOutcomesConfigured(): boolean {
  return getRedis() !== null;
}

function requireRedis(): Redis {
  const r = getRedis();
  if (!r) throw new OutcomesNotConfiguredError();
  return r;
}

let cache: { at: number; records: OutcomeRecord[] } | null = null;

async function writeRecords(redis: Redis, records: OutcomeRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i += 100) {
    const chunk: Record<string, string> = {};
    for (const r of records.slice(i, i + 100)) chunk[r.id] = JSON.stringify(r);
    await redis.hset(HASH_KEY, chunk);
  }
}

async function ensureSeeded(redis: Redis): Promise<void> {
  if (await redis.exists(SEED_KEY)) return;
  // HSET by id is idempotent, so a concurrent double seed is harmless.
  await writeRecords(redis, generateDemoOutcomes());
  await redis.set(SEED_KEY, "1", { nx: true });
}

function parseRow(v: unknown): OutcomeRecord | null {
  try {
    const obj = typeof v === "string" ? JSON.parse(v) : v; // @upstash/redis may auto-deserialize JSON
    const parsed = storedRecordSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** All outcome records (seeds demo data lazily). Throws OutcomesNotConfiguredError if env is missing. */
export async function getAllOutcomes(): Promise<OutcomeRecord[]> {
  const redis = requireRedis();
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.records;
  await ensureSeeded(redis);
  const raw = (await redis.hgetall<Record<string, unknown>>(HASH_KEY)) ?? {};
  const records = Object.values(raw)
    .map(parseRow)
    .filter((r): r is OutcomeRecord => r !== null);
  cache = { at: Date.now(), records };
  return records;
}

export async function putOutcomes(records: OutcomeRecord[]): Promise<void> {
  if (records.length === 0) return;
  const redis = requireRedis();
  // First write wins: a client can't overwrite an existing outcome row.
  await Promise.all(records.map((r) => redis.hsetnx(HASH_KEY, r.id, JSON.stringify(r))));
  cache = null;
}

/** Returns true if the request is allowed. The IP is hashed, never stored raw. */
export async function checkRateLimit(ip: string): Promise<boolean> {
  const redis = requireRedis();
  const ipHash = createHash("sha256").update(`billcheck:${ip}`).digest("hex").slice(0, 24);
  const window = Math.floor(Date.now() / 1000 / RL_WINDOW_S);
  const key = `outcomes:rl:${ipHash}:${window}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, RL_WINDOW_S * 2);
  return n <= RL_MAX;
}
