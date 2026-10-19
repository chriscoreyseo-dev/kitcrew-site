import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationDoc } from "@/lib/generations/model"

import { fakeDb } from "./fakes/mongo"

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  user: null as { id: string; email: string; role: "user" | "admin" } | null,
}))

vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/session", () => ({ currentUser: async () => h.user }))
// lifecycle pulls in the platform client and R2; neither is used here.
vi.mock("@/lib/higgsfield", () => ({ platform: () => ({}) }))
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: () => false,
  copyToR2: async () => null,
  deleteFromR2: async () => undefined,
}))

const actions = await import("@/generation/community-actions")
const community = await import("@/lib/community")

const OWNER = new ObjectId()
const OTHER = new ObjectId()
const OWNER_EMAIL = "christopher@example.com"

function signIn(id: ObjectId, email = "someone@example.com") {
  h.user = { id: id.toHexString(), email, role: "user" }
}

async function seedGeneration(
  extra: Partial<GenerationDoc> = {}
): Promise<GenerationDoc> {
  const now = new Date()
  const doc: GenerationDoc = {
    _id: new ObjectId(),
    userId: OWNER,
    clientRequestId: crypto.randomUUID(),
    surface: "image",
    modelId: "z-image-turbo",
    modelLabel: "Z-Image Turbo",
    modelPath: "secret/model/path",
    prompt: "a lighthouse at dusk",
    settings: { aspectRatio: "16:9", nested: { leak: true } },
    media: [{ role: "reference", url: "https://media.test/private-ref.png" }],
    status: "completed",
    hfRequestId: "hf-req-123",
    cost: 10,
    outputs: [
      {
        kind: "image",
        url: "https://media.test/u/x/0.png",
        r2Key: "u/secret/0.png",
      },
    ],
    aspect: 16 / 9,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
  await h.db.collection("generations").insertOne(doc)
  return doc
}

function stored(id: ObjectId) {
  return h.db
    .collection("generations")
    .findOne({ _id: id }) as Promise<GenerationDoc | null>
}

beforeEach(() => {
  h.db = fakeDb({ rate_limits: [["key"]] })
  h.user = null
  void h.db.collection("users").insertOne({ _id: OWNER, email: OWNER_EMAIL })
  void h.db
    .collection("users")
    .insertOne({ _id: OTHER, email: "other@example.com" })
})

describe("publishGenerationAction", () => {
  it("publishes and unpublishes the owner's completed generation", async () => {
    const gen = await seedGeneration()
    signIn(OWNER, OWNER_EMAIL)

    const on = await actions.publishGenerationAction(
      gen._id.toHexString(),
      true
    )
    expect(on.ok).toBe(true)
    let doc = await stored(gen._id)
    expect(doc?.isPublic).toBe(true)
    expect(doc?.publishedAt).toBeInstanceOf(Date)

    const off = await actions.publishGenerationAction(
      gen._id.toHexString(),
      false
    )
    expect(off).toEqual({
      ok: true,
      data: { id: gen._id.toHexString(), isPublic: false, publishedAt: null },
    })
    doc = await stored(gen._id)
    expect(doc?.isPublic).toBe(false)
    expect(doc?.publishedAt).toBeUndefined()
  })

  it("returns NOT_FOUND for another user's generation and changes nothing", async () => {
    const gen = await seedGeneration()
    signIn(OTHER)
    const result = await actions.publishGenerationAction(
      gen._id.toHexString(),
      true
    )
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" })
    expect((await stored(gen._id))?.isPublic).toBe(false)
  })

  it("returns NOT_FOUND for a malformed id and SIGN_IN when signed out", async () => {
    signIn(OWNER)
    expect(
      await actions.publishGenerationAction("not-an-id", true)
    ).toMatchObject({ ok: false, code: "NOT_FOUND" })
    h.user = null
    const gen = await seedGeneration()
    expect(
      await actions.publishGenerationAction(gen._id.toHexString(), true)
    ).toMatchObject({ ok: false, code: "SIGN_IN" })
  })

  it.each([
    "pending_submit",
    "in_progress",
    "failed",
    "nsfw",
    "canceled",
  ] as const)("refuses to publish a %s generation", async (status) => {
    const gen = await seedGeneration({ status })
    signIn(OWNER)
    const result = await actions.publishGenerationAction(
      gen._id.toHexString(),
      true
    )
    expect(result).toMatchObject({ ok: false, code: "INVALID" })
    expect((await stored(gen._id))?.isPublic).toBe(false)
  })

  it("rejects a non-boolean publish flag", async () => {
    const gen = await seedGeneration()
    signIn(OWNER)
    expect(
      await actions.publishGenerationAction(gen._id.toHexString(), "yes")
    ).toMatchObject({ ok: false, code: "INVALID" })
  })
})

describe("public community data", () => {
  const FORBIDDEN = [
    "userId",
    "email",
    "hfRequestId",
    "r2Key",
    "modelPath",
    "media",
    "cost",
    "clientRequestId",
  ]

  function assertClean(value: unknown) {
    const json = JSON.stringify(value)
    for (const key of FORBIDDEN) expect(json).not.toContain(`"${key}"`)
    expect(json).not.toContain(OWNER_EMAIL)
    expect(json).not.toContain(OWNER.toHexString())
    expect(json).not.toContain("hf-req-123")
    expect(json).not.toContain("u/secret/0.png")
    expect(json).not.toContain("secret/model/path")
    expect(json).not.toContain("private-ref.png")
  }

  it("never exposes private fields in the list or detail DTO", async () => {
    const gen = await seedGeneration({
      isPublic: true,
      publishedAt: new Date(),
    })
    const page = await community.listPublicGenerations()
    expect(page.items).toHaveLength(1)
    assertClean(page)
    const item = page.items[0]!
    expect(item).toMatchObject({
      id: gen._id.toHexString(),
      surface: "image",
      kind: "image",
      urls: ["https://media.test/u/x/0.png"],
      prompt: "a lighthouse at dusk",
      modelId: "z-image-turbo",
      modelLabel: "Z-Image Turbo",
      settings: { aspectRatio: "16:9" },
      author: "chr…",
    })

    const detail = await community.getPublicGeneration(gen._id.toHexString())
    expect(detail).not.toBeNull()
    assertClean(detail)
  })

  it("treats unpublished and unfinished generations as not found", async () => {
    const privateGen = await seedGeneration()
    const failed = await seedGeneration({
      status: "failed",
      isPublic: true,
      publishedAt: new Date(),
    })
    expect(
      await community.getPublicGeneration(privateGen._id.toHexString())
    ).toBeNull()
    expect(
      await community.getPublicGeneration(failed._id.toHexString())
    ).toBeNull()
    expect(await community.getPublicGeneration("nope")).toBeNull()
    expect((await community.listPublicGenerations()).items).toEqual([])
  })

  it("pages newest first by publishedAt cursor without skipping ties", async () => {
    const base = Date.UTC(2026, 0, 1)
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const g = await seedGeneration({
        isPublic: true,
        // Two share a timestamp to exercise the _id tiebreak.
        publishedAt: new Date(base + Math.min(i, 3) * 1000),
      })
      ids.push(g._id.toHexString())
    }
    const first = await community.listPublicGenerations(null, 2)
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()
    const second = await community.listPublicGenerations(first.nextCursor, 2)
    const third = await community.listPublicGenerations(second.nextCursor, 2)
    expect(third.nextCursor).toBeNull()
    const seen = [...first.items, ...second.items, ...third.items].map(
      (i) => i.id
    )
    expect(new Set(seen).size).toBe(5)
    const times = [...first.items, ...second.items, ...third.items].map(
      (i) => i.publishedAt
    )
    expect([...times].sort((a, b) => b - a)).toEqual(times)

    const action = await actions.listCommunityAction(first.nextCursor)
    expect(action.ok && action.data.items.map((i) => i.id)).toEqual(
      [...second.items, ...third.items].map((i) => i.id)
    )
    expect(await actions.listCommunityAction("../etc")).toMatchObject({
      ok: false,
      code: "INVALID",
    })
  })

  it("masks author emails to at most three characters", () => {
    expect(community.maskAuthor("christopher@example.com")).toBe("chr…")
    expect(community.maskAuthor("al@example.com")).toBe("al…")
    expect(community.maskAuthor(undefined)).toBe("creator")
  })

  it("shows the member's MarketHive name, else the masked email (D-065)", async () => {
    await h.db
      .collection("users")
      .updateOne(
        { _id: OWNER },
        { $set: { markethive: { memberId: 7, name: "  Chris Corey  " } } }
      )
    const gen = await seedGeneration({
      isPublic: true,
      publishedAt: new Date(),
    })
    const page = await community.listPublicGenerations()
    expect(page.items[0]!.author).toBe("Chris Corey")
    const detail = await community.getPublicGeneration(gen._id.toHexString())
    expect(detail?.author).toBe("Chris Corey")
    expect(JSON.stringify(page)).not.toContain(OWNER_EMAIL)

    expect(community.authorLabel({ email: OWNER_EMAIL, name: "   " })).toBe(
      "chr…"
    )
    expect(community.authorLabel({ email: OWNER_EMAIL })).toBe("chr…")
    expect(community.authorLabel(null)).toBe("creator")
  })
})

describe("reportGenerationAction", () => {
  it("records one open report per reporter and generation", async () => {
    const gen = await seedGeneration({
      isPublic: true,
      publishedAt: new Date(),
    })
    signIn(OTHER)
    const first = await actions.reportGenerationAction(
      gen._id.toHexString(),
      "spam",
      "  reposted again  "
    )
    expect(first).toEqual({ ok: true, data: { alreadyReported: false } })
    const again = await actions.reportGenerationAction(
      gen._id.toHexString(),
      "other"
    )
    expect(again).toEqual({ ok: true, data: { alreadyReported: true } })
    const docs = h.db.collection("reports").docs
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      reason: "spam",
      note: "reposted again",
      status: "open",
    })
    expect(String(docs[0]!.reporterId)).toBe(OTHER.toHexString())
  })

  it("allows a new report once the earlier one is resolved", async () => {
    const gen = await seedGeneration({
      isPublic: true,
      publishedAt: new Date(),
    })
    signIn(OTHER)
    await actions.reportGenerationAction(gen._id.toHexString(), "spam")
    await h.db
      .collection("reports")
      .updateMany({}, { $set: { status: "dismissed" } })
    const result = await actions.reportGenerationAction(
      gen._id.toHexString(),
      "nsfw"
    )
    expect(result).toEqual({ ok: true, data: { alreadyReported: false } })
    expect(h.db.collection("reports").docs).toHaveLength(2)
  })

  it("requires sign-in, a public generation and a valid reason", async () => {
    const gen = await seedGeneration({
      isPublic: true,
      publishedAt: new Date(),
    })
    const privateGen = await seedGeneration()
    expect(
      await actions.reportGenerationAction(gen._id.toHexString(), "spam")
    ).toMatchObject({ ok: false, code: "SIGN_IN" })
    signIn(OTHER)
    expect(
      await actions.reportGenerationAction(privateGen._id.toHexString(), "spam")
    ).toMatchObject({ ok: false, code: "NOT_FOUND" })
    expect(
      await actions.reportGenerationAction(gen._id.toHexString(), "boring")
    ).toMatchObject({ ok: false, code: "INVALID" })
    expect(
      await actions.reportGenerationAction(
        gen._id.toHexString(),
        "other",
        "x".repeat(501)
      )
    ).toMatchObject({ ok: false, code: "INVALID" })
    expect(h.db.collection("reports").docs).toHaveLength(0)
  })

  it("is rate limited per user", async () => {
    signIn(OTHER)
    const gens = await Promise.all(
      Array.from({ length: 11 }, () =>
        seedGeneration({ isPublic: true, publishedAt: new Date() })
      )
    )
    const results = []
    for (const g of gens)
      results.push(
        await actions.reportGenerationAction(g._id.toHexString(), "spam")
      )
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true)
    expect(results[10]).toMatchObject({ ok: false, code: "RATE_LIMITED" })
    expect(h.db.collection("reports").docs).toHaveLength(10)
  })
})
