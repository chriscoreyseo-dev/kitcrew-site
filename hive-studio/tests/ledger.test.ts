import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fakeDb } from "./fakes/mongo"

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
}))
vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))

const L = await import("@/lib/billing/ledger")
const U = new ObjectId()

async function credits() {
  const u = (await h.db.collection("users").findOne({ _id: U })) as unknown as {
    credits: { subscription: number; topup: number }
  }
  return u.credits
}

beforeEach(async () => {
  h.db = fakeDb({ credit_ledger: [["reason", "refType", "refId"]] })
  await h.db
    .collection("users")
    .insertOne({ _id: U, credits: { subscription: 30, topup: 100 } })
})

describe("ledger", () => {
  it("spends subscription credits first", () => {
    expect(L.splitDebit({ subscription: 30, topup: 100 }, 50)).toEqual({
      subscription: 30,
      topup: 20,
    })
    expect(L.splitDebit({ subscription: 30, topup: 100 }, 131)).toBeNull()
  })

  it("grants are idempotent on (reason, refType, refId)", async () => {
    const grant = {
      userId: U.toHexString(),
      amount: 500,
      bucket: "topup" as const,
      reason: "topup_purchase" as const,
      refType: "checkout_session",
      refId: "cs_1",
    }
    expect(await L.grantCredits(grant)).toBe(true)
    expect(await L.grantCredits(grant)).toBe(false)
    expect((await credits()).topup).toBe(600)
    expect(h.db.collection("credit_ledger").docs).toHaveLength(1)
  })

  it("refunds go back to the buckets the debit used, once", async () => {
    const doc = {
      _id: new ObjectId(),
      userId: U,
      cost: 50,
      costSplit: { subscription: 30, topup: 20 },
    }
    await L.refundGenerationCredits(doc)
    await L.refundGenerationCredits(doc)
    expect(await credits()).toEqual({ subscription: 60, topup: 120 })
  })

  it("a paid invoice resets (not adds) the subscription bucket, once", async () => {
    expect(await L.resetSubscriptionCredits(U, 1000, "in_1")).toBe(true)
    expect(await L.resetSubscriptionCredits(U, 1000, "in_1")).toBe(false)
    expect(await credits()).toEqual({ subscription: 1000, topup: 100 })
    const entry = h.db.collection("credit_ledger").docs[0]!
    expect(entry).toMatchObject({
      reason: "subscription_reset",
      delta: 970,
      balanceAfter: 1100,
    })
  })

  it("a clawback never takes the balance below zero and flags the account", async () => {
    await L.clawbackTopup(U, 250, "ch_1:5000")
    expect((await credits()).topup).toBe(0)
    expect(h.db.collection("credit_ledger").docs[0]).toMatchObject({
      reason: "stripe_refund",
      delta: -100,
    })
    const stored = h.db.collection("users").docs.find((d) => d._id === U)
    expect(stored?.billingFlag).toBe("refund_review")
  })
})
