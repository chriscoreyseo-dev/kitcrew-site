import Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fakeDb } from "./fakes/mongo"

const SECRET = "whsec_test_secret"
const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("./fakes/mongo").fakeDb>,
  handle: vi.fn(),
}))

vi.mock("@/lib/db/mongo", () => ({
  db: () => h.db,
  mongoClient: () => h.db.client,
}))
vi.mock("@/lib/env", () => ({
  env: () => ({ STUDIO_MODE: "standalone" }),
  requireEnv: () => ({
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: SECRET,
  }),
}))
vi.mock("@/lib/billing/stripe-events", () => ({ handleStripeEvent: h.handle }))
vi.mock("@/lib/billing/stripe-effects", () => ({ stripeEffects: () => ({}) }))

const { POST } = await import("@/app/api/webhooks/stripe/route")
const signer = new Stripe("sk_test_dummy")

function request(payload: string, signature: string) {
  return new Request("https://studio.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  })
}

function signed(id = "evt_123") {
  const payload = JSON.stringify({
    id,
    object: "event",
    type: "invoice.paid",
    data: { object: {} },
  })
  return request(
    payload,
    signer.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  )
}

beforeEach(() => {
  h.db = fakeDb({ stripe_events: [["_id"]] })
  h.handle.mockReset()
  h.handle.mockResolvedValue("ok")
})

describe("Stripe webhook route", () => {
  it("rejects a bad signature", async () => {
    const res = await POST(request('{"id":"evt_x"}', "t=1,v1=deadbeef"))
    expect(res.status).toBe(400)
    expect(h.handle).not.toHaveBeenCalled()
  })

  it("processes a signed event once; a redelivery is acknowledged but skipped", async () => {
    expect((await POST(signed())).status).toBe(200)
    expect((await POST(signed())).status).toBe(200)
    expect(h.handle).toHaveBeenCalledTimes(1)
    expect(h.db.collection("stripe_events").docs[0]).toMatchObject({
      _id: "evt_123",
      status: "done",
    })
  })

  it("a failed handler answers 500 and forgets the event so Stripe's retry runs it", async () => {
    h.handle.mockRejectedValueOnce(new Error("db down"))
    expect((await POST(signed())).status).toBe(500)
    expect(h.db.collection("stripe_events").docs).toHaveLength(0)
    expect((await POST(signed())).status).toBe(200)
    expect(h.handle).toHaveBeenCalledTimes(2)
  })
})
