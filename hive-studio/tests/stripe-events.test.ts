import type Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import { PLANS } from "@/lib/billing/plans"
import { handleStripeEvent } from "@/lib/billing/stripe-events"
import type { StripeEffects } from "@/lib/billing/stripe-events"

vi.mock("@/lib/billing/plans", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/plans")>(
    "@/lib/billing/plans"
  )
  const PLANS = {
    ...actual.PLANS,
    plus: { ...actual.PLANS.plus, monthlyCredits: 2000 },
  }
  return {
    ...actual,
    PLANS,
    TOPUPS: {
      ...actual.TOPUPS,
      small: { ...actual.TOPUPS.small, credits: 500 },
    },
    planForPriceId: (id: string, env: Record<string, string | undefined>) => {
      const match = actual.planForPriceId(id, env)
      return match ? { ...match, plan: PLANS[match.plan.id] } : null
    },
  }
})

function effects(overrides: Partial<StripeEffects> = {}) {
  const calls: string[] = []
  const fx: StripeEffects = {
    env: { STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m" },
    userByCustomer: async (id) =>
      id === "cus_1" ? { id: "u1", plan: PLANS.free } : null,
    userById: async (id) =>
      id === "u1" ? { id: "u1", plan: PLANS.free } : null,
    grantTopup: async (u, c, s) => (calls.push(`grant ${u} ${c} ${s}`), true),
    recordTopupPurchase: async (s, p) =>
      void calls.push(`record ${s} ${p.paymentIntent} ${p.credits}`),
    topupByPaymentIntent: async (pi) =>
      pi === "pi_1"
        ? {
            sessionId: "cs_1",
            userId: "u1",
            credits: 500,
            amount: 1000,
            clawed: 0,
          }
        : null,
    setClawed: async (s, n) => void calls.push(`clawed ${s} ${n}`),
    clawback: async (u, c, r) => (calls.push(`clawback ${u} ${c} ${r}`), true),
    resetSubscription: async (u, a, i) => (
      calls.push(`reset ${u} ${a} ${i}`),
      true
    ),
    setPlan: async (u, p, r, s) =>
      void calls.push(`plan ${u} ${p} ${r?.toISOString() ?? "-"} ${s ?? "-"}`),
    sendTopupReceipt: async (u, c) => void calls.push(`receipt ${u} ${c}`),
    log: () => {},
    ...overrides,
  }
  return { fx, calls }
}

const event = (type: string, object: unknown) =>
  ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event

describe("stripe events", () => {
  it("a paid top-up grants server-configured credits, records the purchase and sends a receipt", async () => {
    const { fx, calls } = effects()
    const result = await handleStripeEvent(
      event("checkout.session.completed", {
        id: "cs_1",
        mode: "payment",
        payment_status: "paid",
        client_reference_id: "u1",
        metadata: { packId: "small", credits: "999999" },
        payment_intent: "pi_1",
        amount_total: 1000,
      }),
      fx
    )
    expect(result).toBe("granted 500")
    expect(calls).toEqual([
      "grant u1 500 cs_1",
      "record cs_1 pi_1 500",
      "receipt u1 500",
    ])
  })

  it("ignores unpaid and subscription checkouts", async () => {
    const { fx, calls } = effects()
    await handleStripeEvent(
      event("checkout.session.completed", {
        mode: "payment",
        payment_status: "unpaid",
      }),
      fx
    )
    await handleStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
      }),
      fx
    )
    expect(calls).toEqual([])
  })

  it("invoice.paid resets the subscription bucket to the plan allowance and syncs the plan", async () => {
    const { fx, calls } = effects()
    await handleStripeEvent(
      event("invoice.paid", {
        id: "in_1",
        billing_reason: "subscription_cycle",
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
        lines: {
          data: [
            {
              pricing: { price_details: { price: "price_plus_m" } },
              period: { end: 1800000000 },
            },
          ],
        },
      }),
      fx
    )
    expect(calls).toEqual([
      `plan u1 plus ${new Date(1800000000 * 1000).toISOString()} sub_1`,
      "reset u1 2000 in_1",
    ])
  })

  it("an invoice for an unknown price fails loudly so Stripe retries", async () => {
    const { fx } = effects()
    await expect(
      handleStripeEvent(
        event("invoice.paid", {
          id: "in_2",
          billing_reason: "subscription_create",
          customer: "cus_1",
          lines: {
            data: [{ pricing: { price_details: { price: "price_x" } } }],
          },
        }),
        fx
      )
    ).rejects.toThrow(/Unknown plan/)
  })

  it("subscription deleted drops to free and zeroes plan credits", async () => {
    const { fx, calls } = effects()
    await handleStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        status: "canceled",
        items: { data: [] },
      }),
      fx
    )
    expect(calls).toEqual(["plan u1 free - -", "reset u1 0 sub_1:ended"])
  })

  it("a partial refund claws back proportional top-up credits, cumulatively", async () => {
    const { fx, calls } = effects()
    await handleStripeEvent(
      event("charge.refunded", {
        id: "ch_1",
        payment_intent: "pi_1",
        amount: 1000,
        amount_refunded: 500,
      }),
      fx
    )
    expect(calls).toEqual(["clawback u1 250 ch_1:500", "clawed cs_1 250"])
  })
})
