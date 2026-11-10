import { describe, expect, it } from "vitest"

import { ensureIndexes, INDEXES } from "@/lib/db/indexes"

function fakeDb() {
  const calls: Array<{ collection: string; key: unknown; options: unknown }> =
    []
  return {
    calls,
    collection: (name: string) => ({
      createIndex: async (key: unknown, options: unknown) => {
        calls.push({ collection: name, key, options })
        return "ok"
      },
    }),
  }
}

describe("indexes", () => {
  it("has unique names per collection", () => {
    const names = INDEXES.map((i) => `${i.collection}.${i.options.name}`)
    expect(new Set(names).size).toBe(names.length)
  })

  it("keeps the ledger idempotency key unique", () => {
    const ledger = INDEXES.find(
      (i) => i.collection === "credit_ledger" && i.options.unique
    )
    expect(ledger?.key).toEqual({ reason: 1, refType: 1, refId: 1 })
  })

  it("creates every index, and a second run issues the same calls", async () => {
    const db = fakeDb()
    // The fake only implements what ensureIndexes touches.
    await ensureIndexes(db as unknown as Parameters<typeof ensureIndexes>[0])
    await ensureIndexes(db as unknown as Parameters<typeof ensureIndexes>[0])
    expect(db.calls).toHaveLength(INDEXES.length * 2)
    expect(db.calls.slice(0, INDEXES.length)).toEqual(
      db.calls.slice(INDEXES.length)
    )
  })
})
