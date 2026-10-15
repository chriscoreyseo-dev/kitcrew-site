import { ObjectId } from "mongodb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GenerationDoc } from "@/lib/generations/model"

import { fakeDb } from "./fakes/mongo"

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  platform: {
    submit: vi.fn(),
    status: vi.fn(),
    cancel: vi.fn(),
    createUpload: vi.fn(),
  },
  refunds: [] as string[],
  copies: [] as string[],
  deleted: [] as string[],
}))

vi.mock("@/lib/db/mongo", () => ({ db: () => h.db, mongoClient: () => ({}) }))
vi.mock("@/lib/higgsfield", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/higgsfield/platform")
  >("@/lib/higgsfield/platform")
  return { platform: () => h.platform, PlatformError: actual.PlatformError }
})
vi.mock("@/lib/billing/charges", () => ({
  refundGeneration: async (doc: { _id: ObjectId }) => {
    h.refunds.push(doc._id.toHexString())
  },
}))
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: () => true,
  copyToR2: async (input: {
    userId: string
    generationId: string
    index: number
    sourceUrl: string
  }) => {
    h.copies.push(input.sourceUrl)
    const key = `u/${input.userId}/${input.generationId}/${input.index}.png`
    return {
      key,
      url: `https://media.test/${key}`,
      contentType: "image/png",
      bytes: 10,
    }
  },
  deleteFromR2: async (keys: string[]) => {
    h.deleted.push(...keys)
  },
}))

const { PlatformError, PlatformUnreachableError } =
  await import("@/lib/higgsfield/platform")
const life = await import("@/lib/generations/lifecycle")

const USER = new ObjectId().toHexString()
const OTHER = new ObjectId().toHexString()

function plane(extra: Partial<{ media: Record<string, unknown[]> }> = {}) {
  return {
    model: "z-image-turbo",
    prompt: { text: "a lighthouse at dusk" },
    media: extra.media ?? {},
    settings: {},
  } as never
}

async function submit(
  clientRequestId = crypto.randomUUID(),
  p = plane(),
  userId = USER
) {
  return life.submitGeneration({ userId, plane: p, clientRequestId })
}

function gens() {
  return h.db.collection("generations")
}

async function stored(id: ObjectId) {
  return (await gens().findOne({ _id: id })) as unknown as GenerationDoc | null
}

beforeEach(() => {
  h.db = fakeDb({ generations: [["userId", "clientRequestId"]] })
  h.refunds.length = 0
  h.copies.length = 0
  h.deleted.length = 0
  for (const fn of Object.values(h.platform)) fn.mockReset()
  h.platform.submit.mockResolvedValue({
    requestId: "req-1",
    status: "queued",
    statusUrl: "",
    cancelUrl: "",
  })
})

describe("submit", () => {
  it("queues a validated run with the catalog path, never a client path", async () => {
    const doc = await submit()
    expect(doc.status).toBe("queued")
    expect(doc.hfRequestId).toBe("req-1")
    const [path, body, webhook] = h.platform.submit.mock.calls[0]!
    expect(path).toBe(doc.modelPath)
    expect(body).toMatchObject({ prompt: "a lighthouse at dusk" })
    expect(webhook).toBeUndefined() // no HF_WEBHOOK_BASE_URL in tests
  })

  it("a double click (same clientRequestId) creates one run and one platform job", async () => {
    const id = crypto.randomUUID()
    const [a, b] = await Promise.all([submit(id), submit(id)])
    expect(a._id.toHexString()).toBe(b._id.toHexString())
    expect(gens().docs).toHaveLength(1)
    expect(h.platform.submit).toHaveBeenCalledTimes(1)
  })

  it("rejects unknown models and foreign media without calling the platform", async () => {
    await expect(
      submit(undefined, { ...(plane() as object), model: "nope" } as never)
    ).rejects.toThrow(life.GenerationInputError)
    const foreign = plane({
      media: {
        reference: [
          { id: "x", url: "https://cdn.example.com/x.png", role: "reference" },
        ],
      },
    })
    await expect(submit(undefined, foreign)).rejects.toThrow(/library/)
    expect(h.platform.submit).not.toHaveBeenCalled()
  })

  it("accepts the user's own ready upload as a reference", async () => {
    const url = "https://uploads.example.com/mine.png"
    await h.db.collection("uploads").insertOne({
      _id: new ObjectId(),
      userId: new ObjectId(USER),
      publicUrl: url,
      status: "ready",
      kind: "image",
    })
    const doc = await submit(
      undefined,
      plane({
        media: {
          reference: [{ id: "x", url, role: "reference", kind: "image" }],
        },
      })
    )
    expect(doc.status).toBe("queued")
  })

  it("a definite 4xx fails the run and refunds once", async () => {
    h.platform.submit.mockRejectedValue(
      new PlatformError(422, { detail: "bad aspect" })
    )
    const doc = await submit()
    expect(doc.status).toBe("failed")
    expect(doc.error).toMatch(/bad aspect/)
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("an unclear outcome stays pending_submit; the reconciler refunds it once", async () => {
    h.platform.submit.mockRejectedValue(
      new PlatformUnreachableError(true, new Error("timeout"))
    )
    const doc = await submit()
    expect(doc.status).toBe("pending_submit")
    expect(h.refunds).toEqual([])
    const later = Date.now() + life.PENDING_SUBMIT_GRACE_MS + 1000
    await life.reconcile(later)
    await life.reconcile(later)
    expect((await stored(doc._id))?.status).toBe("failed")
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("caps runs in flight per user", async () => {
    for (let i = 0; i < life.MAX_IN_FLIGHT; i += 1) await submit()
    await expect(submit()).rejects.toThrow(/at once/)
  })
})

describe("finalize", () => {
  it("copies outputs to R2 and is idempotent", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({
      status: "completed",
      requestId: "req-1",
      images: [
        { url: "https://hf.test/a.png" },
        { url: "https://hf.test/b.png" },
      ],
    })
    expect(await life.finalizeGeneration(doc._id)).toBe("settled")
    expect(await life.finalizeGeneration(doc._id)).toBe("skipped")
    const saved = await stored(doc._id)
    expect(saved?.status).toBe("completed")
    expect(saved?.outputs.map((o) => o.url)).toEqual([
      `https://media.test/u/${USER}/${doc._id.toHexString()}/0.png`,
      `https://media.test/u/${USER}/${doc._id.toHexString()}/1.png`,
    ])
    expect(h.copies).toHaveLength(2)
    expect(h.refunds).toEqual([])
  })

  it("concurrent finalizers (webhook + reconciler) settle once", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({
      status: "completed",
      requestId: "req-1",
      images: [{ url: "https://hf.test/a.png" }],
    })
    const results = await Promise.all([
      life.finalizeGeneration(doc._id),
      life.finalizeGeneration(doc._id),
    ])
    expect(results.sort()).toEqual(["settled", "skipped"])
    expect(h.copies).toHaveLength(1)
  })

  it("nsfw refunds exactly once even when the webhook repeats", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({ status: "nsfw", requestId: "req-1" })
    await life.finalizeGeneration(doc._id)
    await life.finalizeGeneration(doc._id)
    const saved = await stored(doc._id)
    expect(saved?.status).toBe("nsfw")
    expect(saved?.error).toBe("Blocked by content filter. Credits refunded.")
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("a non-terminal answer records progress and keeps the run open", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({
      status: "in_progress",
      requestId: "req-1",
    })
    expect(await life.finalizeGeneration(doc._id)).toBe("pending")
    const saved = await stored(doc._id)
    expect(saved?.status).toBe("in_progress")
    expect(saved?.finalizingUntil).toBeUndefined()
  })
})

describe("cancel", () => {
  it("cancels a queued run on the platform and refunds once", async () => {
    const doc = await submit()
    h.platform.cancel.mockResolvedValue(undefined)
    h.platform.status.mockResolvedValue({
      status: "canceled",
      requestId: "req-1",
    })
    expect(await life.cancelGeneration(USER, doc._id.toHexString())).toBe(
      "canceled"
    )
    expect(h.platform.cancel).toHaveBeenCalledWith("req-1")
    expect((await stored(doc._id))?.status).toBe("canceled")
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("cancel racing a webhook finalize still refunds exactly once", async () => {
    const doc = await submit()
    h.platform.cancel.mockResolvedValue(undefined)
    // The webhook's status call resolves only after cancel has finished its own checks.
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    h.platform.status.mockImplementation(async () => {
      await gate
      return { status: "canceled", requestId: "req-1" }
    })
    const webhook = life.finalizeGeneration(doc._id)
    const cancel = life.cancelGeneration(USER, doc._id.toHexString())
    await new Promise((r) => setTimeout(r, 0))
    release()
    await Promise.all([webhook, cancel])
    expect((await stored(doc._id))?.status).toBe("canceled")
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("reports already_started when the platform answers 400", async () => {
    const doc = await submit()
    h.platform.cancel.mockRejectedValue(new PlatformError(400, {}))
    expect(await life.cancelGeneration(USER, doc._id.toHexString())).toBe(
      "already_started"
    )
    expect((await stored(doc._id))?.status).toBe("in_progress")
    expect(h.refunds).toEqual([])
  })

  it("never touches another user's run (looks like not found)", async () => {
    const doc = await submit()
    await expect(
      life.cancelGeneration(OTHER, doc._id.toHexString())
    ).rejects.toThrow(life.GenerationNotFoundError)
    await expect(
      life.deleteGeneration(OTHER, doc._id.toHexString())
    ).rejects.toThrow(life.GenerationNotFoundError)
    expect(h.platform.cancel).not.toHaveBeenCalled()
  })
})

describe("reconcile and delete", () => {
  it("times out runs older than 15 minutes, cancelling queued ones", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({
      status: "queued",
      requestId: "req-1",
    })
    h.platform.cancel.mockResolvedValue(undefined)
    const report = await life.reconcile(
      Date.now() + life.RUN_DEADLINE_MS + 60_000
    )
    expect(report.timedOut).toBe(1)
    expect(h.platform.cancel).toHaveBeenCalledWith("req-1")
    expect((await stored(doc._id))?.error).toMatch(/Timed out/)
    expect(h.refunds).toEqual([doc._id.toHexString()])
  })

  it("delete removes the document and its R2 objects", async () => {
    const doc = await submit()
    h.platform.status.mockResolvedValue({
      status: "completed",
      requestId: "req-1",
      images: [{ url: "https://hf.test/a.png" }],
    })
    await life.finalizeGeneration(doc._id)
    await life.deleteGeneration(USER, doc._id.toHexString())
    expect(gens().docs).toHaveLength(0)
    expect(h.deleted).toEqual([`u/${USER}/${doc._id.toHexString()}/0.png`])
  })
})
