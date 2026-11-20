import { describe, expect, it, vi } from "vitest"

import {
  createPlatformClient,
  mapStatus,
  PlatformError,
  PlatformUnreachableError,
} from "@/lib/higgsfield/platform"
import { outcomeOf, submitFailureIsDefinite } from "@/lib/generations/outcome"

function client(responses: Array<Response | Error>) {
  const calls: string[] = []
  const fetch = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url))
    const next = responses.shift()
    if (!next) throw new Error("no more responses")
    if (next instanceof Error) throw next
    return next
  })
  const c = createPlatformClient({
    apiKey: "id:secret",
    baseUrl: "https://api.test/",
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
    random: () => 0.5,
  })
  return { c, calls, fetch }
}

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) => new Response(JSON.stringify(body), { status, headers })
const queued = () => json(200, { status: "queued", request_id: "r1" })
const refused = Object.assign(new TypeError("fetch failed"), {
  cause: { code: "ECONNREFUSED" },
})
const timeout = Object.assign(
  new Error("The operation was aborted due to timeout"),
  { name: "TimeoutError" }
)

describe("submit retries", () => {
  it("retries 429 and 503, then succeeds", async () => {
    const { c, calls } = client([json(429, {}), json(503, {}), queued()])
    expect((await c.submit("z-image/turbo", { prompt: "x" })).requestId).toBe(
      "r1"
    )
    expect(calls).toHaveLength(3)
  })

  it("does not retry an ambiguous 500 (could double-create the job)", async () => {
    const { c, calls } = client([json(500, { detail: "boom" }), queued()])
    await expect(c.submit("z-image/turbo", {})).rejects.toBeInstanceOf(
      PlatformError
    )
    expect(calls).toHaveLength(1)
  })

  it("retries a connection that never opened, not a timeout", async () => {
    const a = client([refused, queued()])
    expect((await a.c.submit("m", {})).requestId).toBe("r1")
    const b = client([timeout, queued()])
    const error = await b.c.submit("m", {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PlatformUnreachableError)
    expect((error as PlatformUnreachableError).sent).toBe(true)
    expect(b.calls).toHaveLength(1)
  })

  it("appends the webhook as hf_webhook and keeps the token out of logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { c, calls } = client([json(400, {})])
    await c
      .submit(
        "m/x",
        {},
        "https://app.test/api/webhooks/higgsfield?gid=g&t=SECRET"
      )
      .catch(() => {})
    expect(calls[0]).toBe(
      "https://api.test/m/x?hf_webhook=" +
        encodeURIComponent(
          "https://app.test/api/webhooks/higgsfield?gid=g&t=SECRET"
        )
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SECRET")
    warn.mockRestore()
  })

  it("refuses path traversal in model paths", async () => {
    const { c, fetch } = client([])
    await expect(c.submit("../files", {})).rejects.toBeInstanceOf(PlatformError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("status mapping", () => {
  it("reads images, video and audio", () => {
    expect(
      mapStatus({
        status: "completed",
        request_id: "r",
        images: [{ url: "https://a" }],
        audio: { url: "https://b" },
      })
    ).toEqual({
      status: "completed",
      requestId: "r",
      images: [{ url: "https://a" }],
      audio: { url: "https://b" },
    })
  })

  it("maps platform statuses to outcomes", () => {
    expect(outcomeOf({ status: "queued", requestId: "r" })).toEqual({
      kind: "pending",
      status: "queued",
    })
    expect(outcomeOf({ status: "nsfw", requestId: "r" })).toMatchObject({
      kind: "refund",
      status: "nsfw",
    })
    expect(outcomeOf({ status: "completed", requestId: "r" })).toMatchObject({
      kind: "refund",
      status: "failed",
    })
    expect(
      outcomeOf({
        status: "completed",
        requestId: "r",
        video: { url: "http://insecure" },
      })
    ).toMatchObject({ kind: "refund" })
    expect(
      outcomeOf({
        status: "failed",
        requestId: "r",
        error: { detail: "Bad input" },
      })
    ).toMatchObject({
      kind: "refund",
      error: "Bad input Credits refunded.",
    })
    expect(outcomeOf({ status: "weird", requestId: "r" })).toEqual({
      kind: "pending",
      status: "in_progress",
    })
  })

  it("treats only 4xx submit failures as definite", () => {
    expect(submitFailureIsDefinite(422)).toBe(true)
    expect(submitFailureIsDefinite(500)).toBe(false)
    expect(submitFailureIsDefinite(undefined)).toBe(false)
  })
})
