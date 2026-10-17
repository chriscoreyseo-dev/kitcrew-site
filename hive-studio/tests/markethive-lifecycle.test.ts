import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationDoc } from "@/lib/generations/model"

import { fakeDb } from "./fakes/mongo"

/** markethive mode (D-057): MarketHive is the wallet. These tests stand in a
    fake MarketHive that keeps a balance and a per-ref charge table with the
    same idempotency rules as includes/hive_studio_lib.php. */

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  platform: {
    submit: vi.fn(),
    status: vi.fn(),
    cancel: vi.fn(),
    createUpload: vi.fn(),
  },
  mh: {
    balance: 0,
    price: 50 as number | null,
    charges: new Map<string, { amount: number; refunded: boolean }>(),
    down: false,
    debitCalls: 0,
    refundCalls: 0,
  },
}))

vi.mock("@/lib/mode", () => ({
  isMarketHive: () => true,
  studioMode: () => "markethive",
}))
vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/billing/pricing", () => ({
  quoteFor: async () => ({
    enabled: true,
    quote: h.mh.price === null ? null : { credits: h.mh.price, usd: 0 },
  }),
}))
vi.mock("@/lib/higgsfield", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/higgsfield/platform")
  >("@/lib/higgsfield/platform")
  return { platform: () => h.platform, PlatformError: actual.PlatformError }
})
vi.mock("@/lib/storage", () => ({
  isStorageConfigured: () => true,
  storeOutput: async () => ({
    key: "k",
    url: "https://media.test/k",
    contentType: "image/png",
    bytes: 1,
  }),
  deleteOutputs: async () => undefined,
}))
vi.mock("@/lib/markethive/wallet", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/markethive/wallet")
  >("@/lib/markethive/wallet")
  return {
    ...actual,
    walletDebit: async (input: { ref: string }) => {
      h.mh.debitCalls += 1
      if (h.mh.down) throw new actual.WalletUnavailableError("down")
      const prior = h.mh.charges.get(input.ref)
      if (prior) return { charged: prior.amount, balance: h.mh.balance }
      if (h.mh.price === null)
        throw new actual.WalletDeclinedError("unpriced", "Not priced yet.")
      if (h.mh.balance < h.mh.price)
        throw new actual.WalletDeclinedError(
          "insufficient",
          "Not enough",
          h.mh.balance
        )
      h.mh.balance -= h.mh.price
      h.mh.charges.set(input.ref, { amount: h.mh.price, refunded: false })
      return { charged: h.mh.price, balance: h.mh.balance }
    },
    walletRefund: async (input: { ref: string }) => {
      h.mh.refundCalls += 1
      if (h.mh.down) throw new actual.WalletUnavailableError("down")
      const charge = h.mh.charges.get(input.ref)
      if (!charge || charge.refunded)
        return { refunded: false, balance: h.mh.balance }
      charge.refunded = true
      h.mh.balance += charge.amount
      return { refunded: true, balance: h.mh.balance }
    },
  }
})

const { WalletUnavailableError } = await import("@/lib/markethive/wallet")
const { InsufficientCreditsError } = await import("@/lib/billing/ledger")
const { PlatformError } = await import("@/lib/higgsfield/platform")
const life = await import("@/lib/generations/lifecycle")

const USER = new ObjectId().toHexString()
const MEMBER = 4242

const plane = () =>
  ({
    model: "z-image-turbo",
    prompt: { text: "a honeycomb at dawn" },
    media: {},
    settings: {},
  }) as never

const submit = (clientRequestId = crypto.randomUUID()) =>
  life.submitGeneration({ userId: USER, plane: plane(), clientRequestId })

const gens = () => h.db.collection("generations")
const stored = async (id: ObjectId) =>
  (await gens().findOne({ _id: id })) as unknown as GenerationDoc | null

beforeEach(async () => {
  h.db = fakeDb({
    generations: [["userId", "clientRequestId"]],
    credit_ledger: [["reason", "refType", "refId"]],
  })
  Object.assign(h.mh, {
    balance: 1000,
    price: 50,
    down: false,
    debitCalls: 0,
    refundCalls: 0,
  })
  h.mh.charges.clear()
  await h.db.collection("users").insertOne({
    _id: new ObjectId(USER),
    role: "admin",
    markethive: { memberId: MEMBER, email: "m@example.com", name: "M" },
    credits: { subscription: 0, topup: 0 },
  })
  for (const fn of Object.values(h.platform)) fn.mockReset()
  h.platform.submit.mockResolvedValue({
    requestId: "req-1",
    status: "queued",
    statusUrl: "",
    cancelUrl: "",
  })
})

describe("markethive wallet", () => {
  it("debits MarketHive by generation id and records the charged amount", async () => {
    const doc = await submit()
    expect(doc.status).toBe("queued")
    expect(h.mh.balance).toBe(950)
    expect(h.mh.charges.get(doc._id.toHexString())?.amount).toBe(50)
    const saved = await stored(doc._id)
    expect(saved?.cost).toBe(50)
    expect(saved?.wallet).toEqual({
      kind: "markethive",
      memberId: MEMBER,
      state: "debited",
    })
    // Our own ledger is untouched in this mode.
    expect(h.db.collection("credit_ledger").docs).toHaveLength(0)
  })

  it("a double click is debited once", async () => {
    const id = crypto.randomUUID()
    await submit(id)
    await submit(id)
    expect(h.mh.charges.size).toBe(1)
    expect(h.mh.balance).toBe(950)
  })

  it("not enough Hive credits: nothing runs, nothing is stored", async () => {
    h.mh.balance = 20
    await expect(submit()).rejects.toBeInstanceOf(InsufficientCreditsError)
    await expect(submit()).rejects.toThrow(/Your balance is 0\.20/)
    expect(gens().docs).toHaveLength(0)
    expect(h.platform.submit).not.toHaveBeenCalled()
  })

  it("an unpriced surface is refused before the platform is called", async () => {
    h.mh.price = null
    await expect(submit()).rejects.toThrow()
    expect(h.platform.submit).not.toHaveBeenCalled()
  })

  it("a definite platform failure refunds through MarketHive exactly once", async () => {
    h.platform.submit.mockRejectedValue(new PlatformError(422, "bad"))
    const doc = await submit()
    expect(doc.status).toBe("failed")
    expect(h.mh.balance).toBe(1000)
    expect(h.mh.charges.get(doc._id.toHexString())?.refunded).toBe(true)
    // A replayed refund (reconciler, duplicate webhook) changes nothing.
    await life.reconcile()
    expect(h.mh.balance).toBe(1000)
    expect((await stored(doc._id))?.walletRefundPending).toBeUndefined()
  })

  it("nsfw from the platform refunds the member", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({ status: "nsfw" })
    await life.finalizeGeneration(doc._id)
    expect((await stored(doc._id))?.status).toBe("nsfw")
    expect(h.mh.balance).toBe(1000)
  })

  it("MarketHive down at debit: the run fails and is refunded by ref later", async () => {
    h.mh.down = true
    await expect(submit()).rejects.toBeInstanceOf(WalletUnavailableError)
    const run = gens().docs[0] as unknown as GenerationDoc
    expect(run.status).toBe("failed")
    expect(run.walletRefundPending).toBe(true)
    expect(h.platform.submit).not.toHaveBeenCalled()
    h.mh.down = false
    const report = await life.reconcile()
    expect(report.refundsRetried).toBe(1)
    expect((await stored(run._id))?.walletRefundPending).toBeUndefined()
  })

  it("MarketHive down at refund: flagged, then retried until delivered", async () => {
    const doc = await submit()
    h.mh.down = true
    h.platform.status.mockResolvedValue({ status: "failed" })
    await life.finalizeGeneration(doc._id)
    expect((await stored(doc._id))?.walletRefundPending).toBe(true)
    expect(h.mh.balance).toBe(950)
    h.mh.down = false
    await life.reconcile()
    expect(h.mh.balance).toBe(1000)
    expect((await stored(doc._id))?.walletRefundPending).toBeUndefined()
  })

  it("runs MarketHive's parallel limit (4 images) without a studio plan", async () => {
    for (let i = 0; i < 4; i += 1) await submit()
    await expect(submit()).rejects.toThrow(/at a time/)
    expect(h.mh.charges.size).toBe(4)
  })
})
