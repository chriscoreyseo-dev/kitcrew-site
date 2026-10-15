import { describe, expect, it } from "vitest"

import { hit } from "@/lib/rate-limit"
import type { RateLimitDoc } from "@/lib/rate-limit"

/** In-memory stand-in for the upsert + $inc the limiter issues. */
function fakeCollection() {
  const docs = new Map<string, RateLimitDoc>()
  return {
    docs,
    findOneAndUpdate: async (
      filter: { key: string },
      update: { $setOnInsert: { expiresAt: Date } }
    ) => {
      const current = docs.get(filter.key)
      const next = current
        ? { ...current, count: current.count + 1 }
        : {
            key: filter.key,
            count: 1,
            expiresAt: update.$setOnInsert.expiresAt,
          }
      docs.set(filter.key, next)
      return next
    },
  }
}

const limit = { scope: "magic-email", id: "a@b.com", max: 3, windowSec: 900 }

describe("rate limit", () => {
  it("allows up to max in a window, then blocks", async () => {
    const col = fakeCollection()
    // The fake implements only the call hit() makes.
    const c = col as unknown as Parameters<typeof hit>[1]
    const t = 1_000_000_000_000
    const results = []
    for (let i = 0; i < 4; i += 1) results.push(await hit(limit, c, t))
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false])
    expect(results[3]?.retryAfterSec).toBeGreaterThan(0)
  })

  it("starts fresh in the next window, with a TTL at window end", async () => {
    const col = fakeCollection()
    const c = col as unknown as Parameters<typeof hit>[1]
    const t = 1_000_000_000_000
    for (let i = 0; i < 4; i += 1) await hit(limit, c, t)
    expect((await hit(limit, c, t + 900_000)).ok).toBe(true)
    for (const doc of col.docs.values())
      expect(doc.expiresAt.getTime() % 900_000).toBe(0)
  })
})
