import { randomUUID } from "node:crypto"

import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MODELS } from "@/generation/catalog"

import { fakeDb } from "./fakes/mongo"

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  user: null as null | { id: string; email: string; role: "user" | "admin" },
}))
vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/session", () => ({ currentUser: async () => h.user }))

const A = await import("@/generation/admin-actions")

const ADMIN = new ObjectId()
const U = new ObjectId()
const asAdmin = () =>
  (h.user = { id: ADMIN.toHexString(), email: "a@x.test", role: "admin" })
const asUser = () =>
  (h.user = { id: U.toHexString(), email: "u@x.test", role: "user" })

const imageModel = MODELS.find((m) => m.surface === "image")!
const videoModel = MODELS.find((m) => m.surface === "video")!

async function credits() {
  const u = (await h.db.collection("users").findOne({ _id: U })) as unknown as {
    credits: { subscription: number; topup: number }
  }
  return u.credits
}

beforeEach(async () => {
  h.db = fakeDb({
    credit_ledger: [["reason", "refType", "refId"]],
    presets: [["slug"]],
    model_pricing: [["modelId"]],
  })
  h.user = null
  await h.db.collection("users").insertOne({
    _id: U,
    email: "u@x.test",
    credits: { subscription: 30, topup: 100 },
  })
})

const presetInput = (over: Record<string, unknown> = {}) => ({
  slug: "neon-portrait",
  title: "Neon portrait",
  surface: imageModel.surface,
  modelId: imageModel.id,
  promptTemplate: "{subject} in neon light",
  settings: {},
  category: "portrait",
  order: 1,
  active: true,
  ...over,
})

describe("admin actions", () => {
  it("refuse non-admins (and signed-out users) with NOT_FOUND", async () => {
    const id = new ObjectId().toHexString()
    const calls = [
      () =>
        A.adminAdjustCreditsAction({
          userId: U.toHexString(),
          delta: 10,
          bucket: "topup",
          note: "x",
          token: randomUUID(),
        }),
      () => A.adminClearBillingFlagAction(U.toHexString()),
      () =>
        A.adminSetModelPricingAction({
          modelId: imageModel.id,
          rule: { base: { kind: "per_run", usd: 0.1 } },
        }),
      () => A.adminClearModelPricingAction(imageModel.id),
      () =>
        A.adminSetModelEnabledAction({
          modelId: imageModel.id,
          enabled: false,
        }),
      () => A.adminCreatePresetAction(presetInput()),
      () => A.adminUpdatePresetAction(id, presetInput()),
      () => A.adminSetPresetActiveAction({ id, active: false }),
      () => A.adminDeletePresetAction(id),
      () => A.adminDismissReportsAction(id),
      () => A.adminUnpublishGenerationAction(id),
    ]
    for (const who of [() => (h.user = null), asUser]) {
      who()
      for (const call of calls) {
        const result = await call()
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" })
      }
    }
    // Nothing was written.
    expect(await credits()).toEqual({ subscription: 30, topup: 100 })
    expect(h.db.collection("credit_ledger").docs).toHaveLength(0)
    expect(h.db.collection("presets").docs).toHaveLength(0)
    expect(h.db.collection("model_pricing").docs).toHaveLength(0)
  })

  it("admin_adjust is idempotent on its token", async () => {
    asAdmin()
    const input = {
      userId: U.toHexString(),
      delta: 25,
      bucket: "topup",
      note: "Goodwill",
      token: randomUUID(),
    }
    const first = await A.adminAdjustCreditsAction(input)
    const again = await A.adminAdjustCreditsAction(input)
    expect(first).toMatchObject({ ok: true, data: { applied: true } })
    expect(again).toMatchObject({ ok: true, data: { applied: false } })
    expect(await credits()).toEqual({ subscription: 30, topup: 125 })
    const rows = h.db.collection("credit_ledger").docs
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      reason: "admin_adjust",
      refType: "admin",
      refId: input.token,
      delta: 25,
    })
  })

  it("admin_adjust never takes a bucket below zero", async () => {
    asAdmin()
    const result = await A.adminAdjustCreditsAction({
      userId: U.toHexString(),
      delta: -500,
      bucket: "subscription",
      note: "Abuse",
      token: randomUUID(),
    })
    expect(result).toMatchObject({
      ok: true,
      data: { applied: true, credits: { subscription: 0, topup: 100 } },
    })
    expect(h.db.collection("credit_ledger").docs[0]).toMatchObject({
      delta: -30,
      balanceAfter: 100,
    })
  })

  it("admin_adjust rejects a missing note, zero delta or a non-UUID token", async () => {
    asAdmin()
    const base = {
      userId: U.toHexString(),
      delta: 5,
      bucket: "topup",
      note: "ok",
      token: randomUUID(),
    }
    for (const bad of [
      { ...base, note: "  " },
      { ...base, delta: 0 },
      { ...base, delta: 1.5 },
      { ...base, token: "abc" },
      { ...base, bucket: "bonus" },
    ])
      expect(await A.adminAdjustCreditsAction(bad)).toMatchObject({
        ok: false,
        code: "INVALID",
      })
    expect(await credits()).toEqual({ subscription: 30, topup: 100 })
  })

  it("clears billingFlag", async () => {
    asAdmin()
    await h.db
      .collection("users")
      .updateOne({ _id: U }, { $set: { billingFlag: "refund_review" } })
    expect(await A.adminClearBillingFlagAction(U.toHexString())).toMatchObject({
      ok: true,
    })
    const stored = h.db.collection("users").docs.find((d) => d._id === U)
    expect(stored?.billingFlag).toBeUndefined()
  })

  it("validates a pricing override's shape", async () => {
    asAdmin()
    const bad = [
      { base: { kind: "per_minute", usd: 1 } },
      { base: { kind: "per_run", usd: -1 } },
      { base: { kind: "per_run", usd: 0 } },
      { base: { kind: "per_run" } },
      { base: { kind: "per_second", usd: 0.1 } },
      { base: { kind: "per_run", usd: 0.1 }, multipliers: { x: { y: "2" } } },
      { base: { kind: "per_run", usd: 0.1 }, extra: true },
      "0.1",
    ]
    for (const rule of bad)
      expect(
        await A.adminSetModelPricingAction({ modelId: imageModel.id, rule })
      ).toMatchObject({ ok: false, code: "INVALID" })
    expect(
      await A.adminSetModelPricingAction({
        modelId: "no-such-model",
        rule: { base: { kind: "per_run", usd: 0.1 } },
      })
    ).toMatchObject({ ok: false, code: "INVALID" })
    expect(
      await A.adminSetModelPricingAction({
        modelId: imageModel.id,
        rule: {
          base: { kind: "per_run", usd: 0.1 },
          multipliers: { notASetting: { a: 2 } },
        },
      })
    ).toMatchObject({ ok: false, code: "INVALID" })
    expect(h.db.collection("model_pricing").docs).toHaveLength(0)

    const good = { base: { kind: "per_image", usd: 0.02 } }
    expect(
      await A.adminSetModelPricingAction({ modelId: imageModel.id, rule: good })
    ).toMatchObject({ ok: true })
    expect(h.db.collection("model_pricing").docs[0]).toMatchObject({
      modelId: imageModel.id,
      rule: good,
    })

    const { effectivePricing } = await import("@/lib/billing/pricing")
    expect((await effectivePricing())[imageModel.id]?.rule).toEqual(good)

    expect(await A.adminClearModelPricingAction(imageModel.id)).toMatchObject({
      ok: true,
    })
    expect(h.db.collection("model_pricing").docs).toHaveLength(0)
  })

  it("unpublish hides the generation and actions its open reports", async () => {
    asAdmin()
    const G = new ObjectId()
    const other = new ObjectId()
    await h.db.collection("generations").insertOne({
      _id: G,
      userId: U,
      isPublic: true,
      publishedAt: new Date(),
      status: "completed",
    })
    const reports = h.db.collection("reports")
    for (const status of ["open", "open", "dismissed"])
      await reports.insertOne({
        _id: new ObjectId(),
        generationId: G,
        reporterId: new ObjectId(),
        reason: "spam",
        status,
        createdAt: new Date(),
      })
    await reports.insertOne({
      _id: new ObjectId(),
      generationId: other,
      reporterId: new ObjectId(),
      reason: "nsfw",
      status: "open",
      createdAt: new Date(),
    })

    const result = await A.adminUnpublishGenerationAction(G.toHexString())
    expect(result).toMatchObject({ ok: true, data: { actioned: 2 } })
    const gen = h.db.collection("generations").docs[0]!
    expect(gen.isPublic).toBe(false)
    expect(gen.publishedAt).toBeUndefined()
    const mine = reports.docs.filter((r) => r.generationId === G)
    expect(mine.map((r) => r.status).sort()).toEqual([
      "actioned",
      "actioned",
      "dismissed",
    ])
    for (const r of mine.filter((r) => r.status === "actioned")) {
      expect(String(r.resolvedBy)).toBe(ADMIN.toHexString())
      expect(r.resolvedAt).toBeInstanceOf(Date)
    }
    expect(reports.docs.find((r) => r.generationId === other)?.status).toBe(
      "open"
    )
  })

  it("dismiss closes a generation's open reports without unpublishing", async () => {
    asAdmin()
    const G = new ObjectId()
    await h.db
      .collection("generations")
      .insertOne({ _id: G, userId: U, isPublic: true })
    await h.db.collection("reports").insertOne({
      _id: new ObjectId(),
      generationId: G,
      reporterId: new ObjectId(),
      reason: "other",
      status: "open",
      createdAt: new Date(),
    })
    expect(await A.adminDismissReportsAction(G.toHexString())).toMatchObject({
      ok: true,
      data: { dismissed: 1 },
    })
    expect(h.db.collection("reports").docs[0]?.status).toBe("dismissed")
    expect(h.db.collection("generations").docs[0]?.isPublic).toBe(true)
  })

  it("rejects a preset whose model surface doesn't match", async () => {
    asAdmin()
    const mismatch = await A.adminCreatePresetAction(
      presetInput({ surface: "video", modelId: imageModel.id })
    )
    expect(mismatch).toMatchObject({ ok: false, code: "INVALID" })
    const unknown = await A.adminCreatePresetAction(
      presetInput({ modelId: "nope" })
    )
    expect(unknown).toMatchObject({ ok: false, code: "INVALID" })
    const badSlug = await A.adminCreatePresetAction(
      presetInput({ slug: "Bad Slug" })
    )
    expect(badSlug).toMatchObject({ ok: false, code: "INVALID" })
    expect(h.db.collection("presets").docs).toHaveLength(0)
  })

  it("creates, edits, toggles and deletes a preset; slugs stay unique", async () => {
    asAdmin()
    const created = await A.adminCreatePresetAction(presetInput())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const dup = await A.adminCreatePresetAction(presetInput())
    expect(dup).toMatchObject({ ok: false, code: "INVALID" })

    const second = await A.adminCreatePresetAction(
      presetInput({
        slug: "slow-push",
        surface: "video",
        modelId: videoModel.id,
      })
    )
    expect(second.ok).toBe(true)
    // Renaming onto a taken slug is refused.
    expect(
      await A.adminUpdatePresetAction(
        created.data.id,
        presetInput({ slug: "slow-push" })
      )
    ).toMatchObject({ ok: false, code: "INVALID" })

    expect(
      await A.adminUpdatePresetAction(
        created.data.id,
        presetInput({ title: "Neon portrait 2" })
      )
    ).toMatchObject({ ok: true })
    expect(
      await A.adminSetPresetActiveAction({ id: created.data.id, active: false })
    ).toMatchObject({ ok: true })
    const doc = h.db
      .collection("presets")
      .docs.find((d) => String(d._id) === created.data.id)
    expect(doc).toMatchObject({ title: "Neon portrait 2", active: false })

    expect(await A.adminDeletePresetAction(created.data.id)).toMatchObject({
      ok: true,
    })
    expect(h.db.collection("presets").docs).toHaveLength(1)
  })
})
