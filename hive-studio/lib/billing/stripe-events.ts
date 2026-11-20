import type Stripe from "stripe"

import { PLANS, TOPUPS, planForPriceId, planOf, topupCredits } from "./plans"
import type { Plan } from "./plans"

/** Turns verified Stripe events into credit changes. Pure orchestration over
    injected effects, so tests run on real event shapes without Stripe or Mongo.
    Every effect is idempotent (ledger unique keys), so replays are safe. */

export type BillingUser = { id: string; plan: Plan }

export type TopupPurchase = {
  userId: string
  credits: number
  amount: number
  clawed: number
}

export type StripeEffects = {
  env: Record<string, string | undefined>
  userByCustomer(customerId: string): Promise<BillingUser | null>
  userById(userId: string): Promise<BillingUser | null>
  grantTopup(
    userId: string,
    credits: number,
    sessionId: string
  ): Promise<boolean>
  recordTopupPurchase(
    sessionId: string,
    purchase: TopupPurchase & { paymentIntent: string }
  ): Promise<void>
  topupByPaymentIntent(
    paymentIntent: string
  ): Promise<(TopupPurchase & { sessionId: string }) | null>
  setClawed(sessionId: string, clawed: number): Promise<void>
  clawback(userId: string, credits: number, refId: string): Promise<boolean>
  resetSubscription(
    userId: string,
    allowance: number,
    invoiceId: string
  ): Promise<boolean>
  setPlan(
    userId: string,
    plan: Plan["id"],
    renewsAt: Date | null,
    subscriptionId: string | null
  ): Promise<void>
  sendTopupReceipt(userId: string, credits: number): Promise<void>
  log(message: string, data?: Record<string, unknown>): void
}

const idOf = (
  value: string | { id: string } | null | undefined
): string | null => (typeof value === "string" ? value : (value?.id ?? null))

export async function handleStripeEvent(
  event: Stripe.Event,
  fx: StripeEffects
): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object
      if (session.mode !== "payment")
        return "ignored: subscription checkout (credits come from invoice.paid)"
      if (session.payment_status !== "paid") return "ignored: not paid yet"
      const userId = session.client_reference_id ?? session.metadata?.userId
      const pack = TOPUPS[session.metadata?.packId as keyof typeof TOPUPS]
      if (!userId || !pack) return "ignored: not a top-up"
      const user = await fx.userById(userId)
      if (!user) return "ignored: unknown user"
      const credits = topupCredits(pack, user.plan)
      if (!credits) {
        fx.log("[stripe] paid top-up has no configured credits", {
          sessionId: session.id,
          pack: pack.id,
        })
        throw new Error("Top-up credits not configured")
      }
      const granted = await fx.grantTopup(user.id, credits, session.id)
      const paymentIntent = idOf(session.payment_intent)
      if (paymentIntent)
        await fx.recordTopupPurchase(session.id, {
          userId: user.id,
          credits,
          amount: session.amount_total ?? 0,
          clawed: 0,
          paymentIntent,
        })
      if (granted) await fx.sendTopupReceipt(user.id, credits)
      return granted ? `granted ${credits}` : "duplicate"
    }

    case "invoice.paid": {
      const invoice = event.data.object
      if (
        invoice.billing_reason !== "subscription_create" &&
        invoice.billing_reason !== "subscription_cycle"
      )
        return `ignored: ${invoice.billing_reason}`
      const customerId = idOf(invoice.customer)
      const user = customerId ? await fx.userByCustomer(customerId) : null
      if (!user) return "ignored: unknown customer"
      const line = invoice.lines.data.find(
        (l) => l.pricing?.price_details?.price
      )
      const price = idOf(line?.pricing?.price_details?.price)
      const match = price ? planForPriceId(price, fx.env) : null
      if (!match || match.plan.monthlyCredits === null) {
        fx.log("[stripe] paid invoice for an unknown or unpriced plan", {
          invoice: invoice.id,
          price,
        })
        throw new Error("Unknown plan price")
      }
      const renewsAt = line?.period?.end
        ? new Date(line.period.end * 1000)
        : null
      const subscriptionId = idOf(
        invoice.parent?.subscription_details?.subscription
      )
      await fx.setPlan(user.id, match.plan.id, renewsAt, subscriptionId)
      const reset = await fx.resetSubscription(
        user.id,
        match.plan.monthlyCredits,
        invoice.id ?? `invoice-${event.id}`
      )
      return reset ? `reset to ${match.plan.monthlyCredits}` : "duplicate"
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object
      const customerId = idOf(sub.customer)
      const user = customerId ? await fx.userByCustomer(customerId) : null
      if (!user) return "ignored: unknown customer"
      const item = sub.items.data[0]
      const ended =
        event.type === "customer.subscription.deleted" ||
        sub.status === "canceled"
      if (ended) {
        // Subscription credits last until the period ends; deletion is that moment.
        await fx.setPlan(user.id, "free", null, null)
        await fx.resetSubscription(user.id, 0, `${sub.id}:ended`)
        return "ended"
      }
      const match = item ? planForPriceId(item.price.id, fx.env) : null
      if (!match) return "ignored: unknown price"
      await fx.setPlan(
        user.id,
        match.plan.id,
        item ? new Date(item.current_period_end * 1000) : null,
        sub.id
      )
      return `plan ${match.plan.id}`
    }

    case "charge.refunded": {
      const charge = event.data.object
      const paymentIntent = idOf(charge.payment_intent)
      const purchase = paymentIntent
        ? await fx.topupByPaymentIntent(paymentIntent)
        : null
      if (!purchase || !charge.amount) return "ignored: not a top-up charge"
      const target = Math.floor(
        (purchase.credits * charge.amount_refunded) / charge.amount
      )
      const delta = target - purchase.clawed
      if (delta <= 0) return "nothing to claw back"
      await fx.clawback(
        purchase.userId,
        delta,
        `${charge.id}:${charge.amount_refunded}`
      )
      await fx.setClawed(purchase.sessionId, target)
      return `clawed ${delta}`
    }

    default:
      return `ignored: ${event.type}`
  }
}

export { PLANS, planOf }
