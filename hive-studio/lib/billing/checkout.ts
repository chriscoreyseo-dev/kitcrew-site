import "server-only"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"
import { GenerationInputError } from "@/lib/generations/lifecycle"
import { stripe } from "@/lib/stripe"

import { PLANS, TOPUPS, planOf, topupCredits } from "./plans"
import type { Interval, PlanId, TopupId } from "./plans"

type UserDoc = {
  _id: ObjectId
  email?: string
  stripeCustomerId?: string
  plan?: string
}
const users = () => db().collection<UserDoc>("users")

/** Created lazily at first checkout, never at sign-up. */
export async function ensureCustomer(userId: string): Promise<string> {
  const _id = new ObjectId(userId)
  const user = await users().findOne({ _id })
  if (!user) throw new GenerationInputError("Account not found.")
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe().customers.create(
    { ...(user.email ? { email: user.email } : {}), metadata: { userId } },
    { idempotencyKey: `customer-${userId}` }
  )
  // Only set if still unset, so two racing checkouts keep one customer.
  await users().updateOne(
    { _id, stripeCustomerId: { $exists: false } },
    { $set: { stripeCustomerId: customer.id } }
  )
  return (await users().findOne({ _id }))?.stripeCustomerId ?? customer.id
}

function priceId(envName: string): string {
  const id = (env() as unknown as Record<string, string | undefined>)[envName]
  if (!id) throw new GenerationInputError("That option isn't available yet.")
  return id
}

function urls(path: string) {
  const base = env().APP_URL.replace(/\/$/, "")
  return {
    success_url: `${base}${path}?checkout=success`,
    cancel_url: `${base}${path}?checkout=canceled`,
  }
}

export async function createSubscriptionCheckout(
  userId: string,
  planId: PlanId,
  interval: Interval
): Promise<string> {
  const plan = PLANS[planId]
  if (!plan?.stripePriceEnv || plan.monthlyCredits === null)
    throw new GenerationInputError("That plan isn't available yet.")
  const customer = await ensureCustomer(userId)
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [
      { price: priceId(plan.stripePriceEnv[interval]), quantity: 1 },
    ],
    metadata: { userId, kind: "subscription", planId, interval },
    subscription_data: { metadata: { userId, planId } },
    allow_promotion_codes: true,
    ...urls("/account/billing"),
  })
  if (!session.url) throw new Error("Stripe returned no checkout URL")
  return session.url
}

export async function createTopupCheckout(
  userId: string,
  packId: TopupId
): Promise<string> {
  const pack = TOPUPS[packId]
  const owner = await users().findOne(
    { _id: new ObjectId(userId) },
    { projection: { plan: 1 } }
  )
  if (!pack || topupCredits(pack, planOf(owner?.plan)) === null)
    throw new GenerationInputError("That pack isn't available yet.")
  const customer = await ensureCustomer(userId)
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceId(pack.stripePriceEnv), quantity: 1 }],
    // Credits are recomputed from server config at fulfilment, never read from here.
    metadata: { userId, kind: "topup", packId },
    payment_intent_data: { metadata: { userId, kind: "topup", packId } },
    ...urls("/account/billing"),
  })
  if (!session.url) throw new Error("Stripe returned no checkout URL")
  return session.url
}

export async function createPortalSession(userId: string): Promise<string> {
  const user = await users().findOne({ _id: new ObjectId(userId) })
  if (!user?.stripeCustomerId)
    throw new GenerationInputError("You don't have billing history yet.")
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env().APP_URL.replace(/\/$/, "")}/account/billing`,
  })
  return session.url
}
