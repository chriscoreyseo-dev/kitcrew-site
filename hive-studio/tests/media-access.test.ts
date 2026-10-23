import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { ObjectId } from "mongodb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fakeDb } from "./fakes/mongo"

/** D-063: /media serves a file only to its owner, an admin, anyone for a
    published or cover item, or a signed link. The path alone grants nothing. */

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  user: null as { id: string; email: string; role: "user" | "admin" } | null,
}))

vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/session", () => ({ currentUser: async () => h.user }))

const APP = "https://studio.example.com"
const OWNER = new ObjectId()
const OTHER = new ObjectId()
const GEN = new ObjectId()
const KEY = `u/${OWNER.toHexString()}/${GEN.toHexString()}/0.jpg`
const BYTES = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17])

let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "hive-media-access-"))
  vi.stubEnv("STORAGE_DRIVER", "local")
  vi.stubEnv("LOCAL_STORAGE_DIR", dir)
  vi.stubEnv("APP_URL", APP)
  vi.stubEnv("HF_WEBHOOK_SECRET", "w".repeat(40))
  vi.stubEnv("AUTH_SECRET", "")
  h.db = fakeDb()
  h.user = null
  const file = path.join(dir, ...KEY.split("/"))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, BYTES)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllEnvs()
  vi.resetModules()
})

const access = () => import("@/lib/storage/media-access")

async function seedGeneration(extra: Record<string, unknown> = {}) {
  await h.db.collection("generations").insertOne({
    _id: GEN,
    userId: OWNER,
    status: "completed",
    isPublic: false,
    outputs: [{ kind: "image", url: `${APP}/media/${KEY}` }],
    ...extra,
  })
}

function signIn(id: ObjectId, role: "user" | "admin" = "user") {
  h.user = { id: id.toHexString(), email: "m@example.com", role }
}

async function get(url: string, headers: Record<string, string> = {}) {
  const { GET } = await import("@/app/media/[...key]/route")
  const key = new URL(url).pathname.replace(/^\/media\//, "").split("/")
  return GET(new Request(url, { headers }), {
    params: Promise.resolve({ key }),
  })
}

describe("signed media links", () => {
  it("verifies its own signature and nothing else", async () => {
    const { signMediaKey, verifyMediaSignature } = await access()
    const now = Date.now()
    const { exp, sig } = signMediaKey(KEY, now)
    expect(verifyMediaSignature(KEY, String(exp), sig, now)).toBe(true)
    // Another key, a flipped character, a missing part: all refused.
    const otherKey = `u/${OTHER.toHexString()}/${GEN.toHexString()}/0.jpg`
    expect(verifyMediaSignature(otherKey, String(exp), sig, now)).toBe(false)
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1)
    expect(verifyMediaSignature(KEY, String(exp), flipped, now)).toBe(false)
    expect(verifyMediaSignature(KEY, null, sig, now)).toBe(false)
    expect(verifyMediaSignature(KEY, String(exp), null, now)).toBe(false)
    expect(verifyMediaSignature(KEY, String(exp + 1), sig, now)).toBe(false)
  })

  it("expires, and refuses an expiry further out than the TTL", async () => {
    const { MEDIA_LINK_TTL_SECONDS, signMediaKey, verifyMediaSignature } =
      await access()
    const now = Date.now()
    const { exp, sig } = signMediaKey(KEY, now)
    const later = now + (MEDIA_LINK_TTL_SECONDS + 1) * 1000
    expect(verifyMediaSignature(KEY, String(exp), sig, later)).toBe(false)
    const long = signMediaKey(KEY, now, MEDIA_LINK_TTL_SECONDS * 30)
    expect(verifyMediaSignature(KEY, String(long.exp), long.sig, now)).toBe(
      false
    )
  })

  it("refuses every link when no studio secret is configured", async () => {
    vi.stubEnv("HF_WEBHOOK_SECRET", "")
    const { verifyMediaSignature } = await access()
    expect(verifyMediaSignature(KEY, "9999999999", "x".repeat(43))).toBe(false)
  })

  it("signs only our own /media URLs inside a platform body", async () => {
    const { signLocalMediaUrls } = await access()
    const own = `${APP}/media/${KEY}`
    const body = {
      prompt: `see ${own}`,
      image_url: own,
      references: [{ url: own }, "https://cdn.higgsfield.ai/up/1.png"],
      foreign: `https://evil.example/media/${KEY}`,
      steps: 4,
      flag: true,
    }
    const signed = signLocalMediaUrls(body)
    expect(signed.image_url).toMatch(
      new RegExp(
        `^${own.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\?exp=\\d+&sig=[\\w-]+$`
      )
    )
    expect((signed.references[0] as { url: string }).url).toBe(signed.image_url)
    expect(signed.references[1]).toBe("https://cdn.higgsfield.ai/up/1.png")
    expect(signed.foreign).toBe(body.foreign)
    expect(signed.prompt).toBe(body.prompt)
    expect(signed.steps).toBe(4)
    expect(signed.flag).toBe(true)
    // The stored body is untouched (ownership checks match on the plain URL).
    expect(body.image_url).toBe(own)
  })
})

describe("mediaAccess", () => {
  it("lets the owner and admins see private media, nobody else", async () => {
    await seedGeneration()
    const { mediaAccess } = await access()
    expect(await mediaAccess(KEY, { id: OWNER.toHexString() })).toBe("private")
    expect(
      await mediaAccess(KEY, { id: OTHER.toHexString(), role: "admin" })
    ).toBe("private")
    expect(await mediaAccess(KEY, { id: OTHER.toHexString() })).toBeNull()
    expect(await mediaAccess(KEY, null)).toBeNull()
  })

  it("opens published, completed generations to everyone", async () => {
    await seedGeneration({ isPublic: true })
    const { mediaAccess } = await access()
    expect(await mediaAccess(KEY, null)).toBe("public")
    expect(await mediaAccess(KEY, { id: OTHER.toHexString() })).toBe("public")
  })

  it("keeps a published flag on another member's id from opening this key", async () => {
    // Same generation id, different owner in the path: no match.
    await seedGeneration({ isPublic: true, userId: OTHER })
    const { mediaAccess } = await access()
    expect(await mediaAccess(KEY, null)).toBeNull()
  })

  it("does not open a published run that isn't completed", async () => {
    await seedGeneration({ isPublic: true, status: "failed" })
    const { mediaAccess } = await access()
    expect(await mediaAccess(KEY, null)).toBeNull()
  })

  it("opens an effect's cover image to everyone", async () => {
    await seedGeneration()
    await h.db
      .collection("presets")
      .insertOne({ _id: new ObjectId(), coverUrl: `${APP}/media/${KEY}` })
    const { mediaAccess } = await access()
    expect(await mediaAccess(KEY, null)).toBe("public")
  })

  it("opens an ACTIVE effect's template media to everyone (S611), not an inactive one's", async () => {
    const { mediaAccess } = await access()
    await h.db.collection("presets").insertOne({
      _id: new ObjectId(),
      active: false,
      media: [{ role: "video", url: `${APP}/media/${KEY}`, kind: "video" }],
    })
    expect(await mediaAccess(KEY, null)).toBeNull()
    await h.db.collection("presets").updateOne({}, { $set: { active: true } })
    expect(await mediaAccess(KEY, null)).toBe("public")
  })

  it("refuses anything that isn't an exact media key", async () => {
    const { mediaAccess } = await access()
    expect(await mediaAccess("u/../../etc/passwd", null)).toBeNull()
    expect(
      await mediaAccess(`u/${OWNER.toHexString()}/x/0.jpg`, {
        id: OWNER.toHexString(),
      })
    ).toBeNull()
  })
})

describe("GET /media/[...key]", () => {
  const url = `${APP}/media/${KEY}`

  it("answers 404 with no session (the S581 production finding)", async () => {
    await seedGeneration()
    const response = await get(url)
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("answers 404 to another signed-in member", async () => {
    await seedGeneration()
    signIn(OTHER)
    expect((await get(url)).status).toBe(404)
  })

  it("serves the owner, privately cached", async () => {
    await seedGeneration()
    signIn(OWNER)
    const response = await get(url)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/jpeg")
    expect(response.headers.get("cache-control")).toMatch(/^private/)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES)
  })

  it("still supports Range for the owner (video seeking)", async () => {
    await seedGeneration()
    signIn(OWNER)
    const response = await get(url, { range: "bytes=2-4" })
    expect(response.status).toBe(206)
    expect(response.headers.get("content-range")).toBe("bytes 2-4/8")
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      12, 13, 14,
    ])
  })

  it("serves a published item to anyone, publicly cached", async () => {
    await seedGeneration({ isPublic: true })
    const response = await get(url)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toMatch(/^public/)
  })

  it("serves a signed link with no session (the platform's fetch)", async () => {
    await seedGeneration()
    const { signedMediaUrl } = await access()
    const response = await get(signedMediaUrl(url))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toMatch(/^private/)
  })

  it("refuses a signed link for one key used on another", async () => {
    await seedGeneration()
    const { signedMediaUrl } = await access()
    const query = new URL(signedMediaUrl(url)).search
    const other = `${APP}/media/u/${OTHER.toHexString()}/${GEN.toHexString()}/0.jpg`
    expect((await get(`${other}${query}`)).status).toBe(404)
  })

  it("gives a missing file the same 404 as a forbidden one", async () => {
    signIn(OWNER)
    const missing = `${APP}/media/u/${OWNER.toHexString()}/${new ObjectId().toHexString()}/0.jpg`
    const response = await get(missing)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not found")
  })
})
