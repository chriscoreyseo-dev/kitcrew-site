import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env", () => ({ requireEnv: () => ({}) }))

const { verifyWebhookToken, webhookToken, webhookUrlFor } =
  await import("@/lib/higgsfield/webhook")
const { outputKey } = await import("@/lib/storage/r2")
const { toRunDTO } = await import("@/lib/generations/model")
const { ObjectId } = await import("mongodb")

const SECRET = "s".repeat(32)

describe("webhook token", () => {
  it("verifies only the token issued for that generation", () => {
    const t = webhookToken("gen-a", SECRET)
    expect(verifyWebhookToken("gen-a", t, SECRET)).toBe(true)
    expect(verifyWebhookToken("gen-b", t, SECRET)).toBe(false)
    expect(verifyWebhookToken("gen-a", t, "x".repeat(32))).toBe(false)
    expect(verifyWebhookToken("gen-a", t.slice(0, -1), SECRET)).toBe(false)
    expect(verifyWebhookToken("gen-a", "", SECRET)).toBe(false)
  })

  it("builds the URL only when webhooks are configured", () => {
    expect(webhookUrlFor("g", {})).toBeUndefined()
    const url = new URL(
      webhookUrlFor("g1", {
        HF_WEBHOOK_BASE_URL: "https://studio.kitcrew.ai",
        HF_WEBHOOK_SECRET: SECRET,
      })!
    )
    expect(url.pathname).toBe("/api/webhooks/higgsfield")
    expect(url.searchParams.get("gid")).toBe("g1")
    expect(verifyWebhookToken("g1", url.searchParams.get("t")!, SECRET)).toBe(
      true
    )
  })
})

describe("R2 keys", () => {
  it("uses u/{user}/{generation}/{n}.{ext} with the real content type", () => {
    expect(outputKey("u1", "g1", 0, "image/webp", "image")).toEqual({
      key: "u/u1/g1/0.webp",
      contentType: "image/webp",
    })
    expect(outputKey("u1", "g1", 2, "video/mp4; codecs=avc1", "video")).toEqual(
      { key: "u/u1/g1/2.mp4", contentType: "video/mp4" }
    )
    expect(
      outputKey("u1", "g1", 0, "application/octet-stream", "audio")
    ).toEqual({ key: "u/u1/g1/0.mp3", contentType: "audio/mpeg" })
  })
})

describe("run DTO", () => {
  it("exposes outputs only when completed and hides internals", () => {
    const base = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      clientRequestId: "c",
      surface: "image" as const,
      modelId: "m",
      modelLabel: "M",
      modelPath: "p",
      prompt: "x",
      settings: {},
      media: [],
      cost: 0,
      outputs: [
        { kind: "image" as const, url: "https://media/a.png", r2Key: "k" },
      ],
      aspect: 1,
      isPublic: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }
    const done = toRunDTO({
      ...base,
      status: "completed",
      hfRequestId: "secret-req",
    })
    expect(done.urls).toEqual(["https://media/a.png"])
    expect(JSON.stringify(done)).not.toMatch(
      /secret-req|userId|r2Key|modelPath/
    )
    expect(toRunDTO({ ...base, status: "in_progress" })).toMatchObject({
      status: "running",
      urls: [],
    })
    expect(
      toRunDTO({ ...base, status: "nsfw", error: "Blocked" })
    ).toMatchObject({ status: "failed", phase: "nsfw" })
  })
})
