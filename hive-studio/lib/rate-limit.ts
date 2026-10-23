import "server-only"

import type { Collection } from "mongodb"

import { db } from "@/lib/db/mongo"

/** Fixed-window counters in Mongo (`rate_limits`, TTL on expiresAt), so no Redis.
    One document per key per window; the unique `key` index makes concurrent
    increments of a fresh window safe. */

export type RateLimitDoc = { key: string; count: number; expiresAt: Date }

export type Limit = {
  scope: string
  id: string
  max: number
  windowSec: number
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

export async function hit(
  limit: Limit,
  collection: Pick<
    Collection<RateLimitDoc>,
    "findOneAndUpdate"
  > = db().collection<RateLimitDoc>("rate_limits"),
  now = Date.now()
): Promise<RateLimitResult> {
  const windowMs = limit.windowSec * 1000
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = `${limit.scope}:${limit.id}:${windowStart}`
  const doc = await collection.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + windowMs) },
    },
    { upsert: true, returnDocument: "after" }
  )
  const count = doc?.count ?? 1
  return {
    ok: count <= limit.max,
    remaining: Math.max(0, limit.max - count),
    retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000),
  }
}

/** Every limit must pass; all are counted so a blocked caller keeps paying. */
export async function hitAll(limits: Limit[]): Promise<RateLimitResult> {
  const results = await Promise.all(limits.map((limit) => hit(limit)))
  const blocked = results.filter((r) => !r.ok)
  if (!blocked.length)
    return results[0] ?? { ok: true, remaining: 0, retryAfterSec: 0 }
  return {
    ok: false,
    remaining: 0,
    retryAfterSec: Math.max(...blocked.map((r) => r.retryAfterSec)),
  }
}

export const MAGIC_LINK_LIMITS = (email: string, ip: string): Limit[] => [
  { scope: "magic-email", id: email, max: 3, windowSec: 15 * 60 },
  { scope: "magic-ip", id: ip, max: 10, windowSec: 60 * 60 },
]

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip") || "unknown"
}
