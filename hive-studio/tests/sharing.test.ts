import { ObjectId } from "mongodb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fakeDb } from "./fakes/mongo"

/** S581: a member's Share button marks one run shared (its files go public) and
    returns their MarketHive link; MarketHive's page reads /api/shared/<slug>. */

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  user: null as { id: string; email: string; role: "user" | "admin" } | null,
}))

vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/session", () => ({ currentUser: async () => h.user }))
vi.mock("@/lib/rate-limit", () => ({ hit: async () => ({ ok: true }) }))

const APP = "https://studio.example.com"
const MH = "https://markethive.example.com"
const OWNER = new ObjectId()
const OTHER = new ObjectId()
const GEN = new ObjectId()
const KEY = (n: number) =>
  `u/${OWNER.toHexString()}/${GEN.toHexString()}/${n}.jpg`

beforeEach(async () => {
  vi.stubEnv("APP_URL", APP)
  vi.stubEnv("MARKETHIVE_BASE_URL", MH)
  vi.stubEnv("HF_WEBHOOK_SECRET", "w".repeat(40))
  vi.stubEnv("AUTH_SECRET", "")
  h.db = fakeDb()
  h.user = null
  await h.db
    .collection("users")
    .insertOne({ _id: OWNER, markethive: { memberId: 154950 } })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function seed(extra: Record<string, unknown> = {}) {
  await h.db.collection("generations").insertOne({
    _id: GEN,
    userId: OWNER,
    status: "completed",
    isPublic: false,
    prompt: "secret recipe",
    aspect: 0.5625,
    createdAt: new Date("2026-10-18T05:00:00Z"),
    outputs: [
      { kind: "image", url: `${APP}/media/${KEY(0)}` },
      { kind: "image", url: `${APP}/media/${KEY(1)}` },
    ],
    ...extra,
  })
}

const sharing = () => import("@/lib/sharing")

function share(id: string, body: unknown, origin = APP) {
  return import("@/app/api/generations/[id]/share/route").then(({ POST }) =>
    POST(
      new Request(`${APP}/api/generations/${id}/share`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    )
  )
}

describe("share slugs", () => {
  it("round-trips the run id and output index", async () => {
    const { parseShareSlug, shareSlug } = await sharing()
    const id = GEN.toHexString()
    expect(shareSlug(id)).toBe(id)
    expect(shareSlug(id, 2)).toBe(`${id}-2`)
    expect(parseShareSlug(`${id}-2`)).toEqual({ runId: id, index: 2 })
    expect(parseShareSlug(id)).toEqual({ runId: id, index: 0 })
    for (const bad of [`${id}-0`, `${id}-x`, "nope", `${id}/fb`, `${id}-100`])
      expect(parseShareSlug(bad)).toBeNull()
  })

  it("builds the MarketHive link", async () => {
    const { shareUrl } = await sharing()
    expect(shareUrl("abc")).toBe(`${MH}/watch/studio/abc`)
  })
})

describe("markShared", () => {
  it("marks the owner's finished run once, keeping the first time", async () => {
    await seed()
    const { markShared } = await sharing()
    const first = new Date("2026-10-18T06:00:00Z")
    expect(
      await markShared(OWNER.toHexString(), GEN.toHexString(), 1, first)
    ).toBe(true)
    expect(
      await markShared(OWNER.toHexString(), GEN.toHexString(), 0, new Date())
    ).toBe(true)
    const doc = await h.db.collection("generations").findOne({ _id: GEN })
    expect((doc as unknown as { sharedAt: Date }).sharedAt.getTime()).toBe(
      first.getTime()
    )
  })

  it("refuses someone else's run, an unfinished run and a missing output", async () => {
    await seed({ status: "failed" })
    const { markShared } = await sharing()
    expect(await markShared(OWNER.toHexString(), GEN.toHexString(), 0)).toBe(
      false
    )
    await h.db
      .collection("generations")
      .updateOne({ _id: GEN }, { $set: { status: "completed" } })
    expect(await markShared(OTHER.toHexString(), GEN.toHexString(), 0)).toBe(
      false
    )
    expect(await markShared(OWNER.toHexString(), GEN.toHexString(), 2)).toBe(
      false
    )
    const doc = await h.db.collection("generations").findOne({ _id: GEN })
    expect((doc as unknown as { sharedAt?: Date }).sharedAt).toBeUndefined()
  })
})

describe("sharedView", () => {
  it("is null until the run is shared", async () => {
    await seed()
    const { sharedView } = await sharing()
    expect(await sharedView(GEN.toHexString())).toBeNull()
  })

  it("returns the chosen output and the owner's member id, never the prompt", async () => {
    await seed({ sharedAt: new Date() })
    const { sharedView } = await sharing()
    const view = await sharedView(`${GEN.toHexString()}-1`)
    expect(view).toMatchObject({
      kind: "image",
      src: `${APP}/media/${KEY(1)}`,
      memberId: 154950,
    })
    expect(JSON.stringify(view)).not.toContain("secret recipe")
    expect(await sharedView(`${GEN.toHexString()}-5`)).toBeNull()
  })
})

describe("media access for shared runs", () => {
  it("opens a shared run's files to everyone and keeps unshared ones private", async () => {
    await seed()
    const { mediaAccess } = await import("@/lib/storage/media-access")
    expect(await mediaAccess(KEY(0), null)).toBeNull()
    await h.db
      .collection("generations")
      .updateOne({ _id: GEN }, { $set: { sharedAt: new Date() } })
    expect(await mediaAccess(KEY(0), null)).toBe("public")
  })
})

describe("POST /api/generations/<id>/share", () => {
  it("needs a signed-in member on the studio's own origin", async () => {
    await seed()
    expect((await share(GEN.toHexString(), { index: 0 })).status).toBe(401)
    h.user = { id: OWNER.toHexString(), email: "m@example.com", role: "user" }
    expect(
      (await share(GEN.toHexString(), { index: 0 }, "https://evil.example"))
        .status
    ).toBe(403)
  })

  it("shares the owner's output and returns the MarketHive link", async () => {
    await seed()
    h.user = { id: OWNER.toHexString(), email: "m@example.com", role: "user" }
    const res = await share(GEN.toHexString(), { index: 1 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      slug: `${GEN.toHexString()}-1`,
      url: `${MH}/watch/studio/${GEN.toHexString()}-1`,
    })
  })

  it("is 404 for another member's run and 400 for a bad index", async () => {
    await seed()
    h.user = { id: OTHER.toHexString(), email: "o@example.com", role: "user" }
    expect((await share(GEN.toHexString(), { index: 0 })).status).toBe(404)
    expect((await share(GEN.toHexString(), { index: -1 })).status).toBe(400)
  })
})

describe("Add credits", () => {
  it("opens the Hive Vault in MarketHive's wallet", async () => {
    const { hiveVaultUrl } = await import("@/lib/mode-info")
    expect(hiveVaultUrl(`${MH}/`)).toBe(
      `${MH}/index_members?wallet-popup-subsection-vault`
    )
  })
})
