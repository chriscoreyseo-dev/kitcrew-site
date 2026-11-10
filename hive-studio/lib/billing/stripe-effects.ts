import "server-only"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import { sendCreditsAdded } from "@/lib/email"
import { env } from "@/lib/env"

import {
  balanceOf,
  clawbackTopup,
  grantCredits,
  resetSubscriptionCredits,
} from "./ledger"
import { planOf } from "./plans"
import type { StripeEffects } from "./stripe-events"

type UserDoc = {
  _id: ObjectId
  email?: string
  plan?: string
  stripeCustomerId?: string
}
type PurchaseDoc = {
  _id: string
  userId: string
  paymentIntent: string
  credits: number
  amount: number
  clawed: number
  createdAt: Date
}

const users = () => db().collection<UserDoc>("users")
const purchases = () => db().collection<PurchaseDoc>("topup_purchases")

export function stripeEffects(): StripeEffects {
  return {
    env: env() as unknown as Record<string, string | undefined>,
    async userByCustomer(customerId) {
      const u = await users().findOne({ stripeCustomerId: customerId })
      return u ? { id: u._id.toHexString(), plan: planOf(u.plan) } : null
    },
    async userById(userId) {
      if (!ObjectId.isValid(userId)) return null
      const u = await users().findOne({ _id: new ObjectId(userId) })
      return u ? { id: u._id.toHexString(), plan: planOf(u.plan) } : null
    },
    grantTopup: (userId, credits, sessionId) =>
      grantCredits({
        userId,
        amount: credits,
        bucket: "topup",
        reason: "topup_purchase",
        refType: "checkout_session",
        refId: sessionId,
      }),
    async recordTopupPurchase(sessionId, p) {
      await purchases().updateOne(
        { _id: sessionId },
        { $setOnInsert: { _id: sessionId, ...p, createdAt: new Date() } },
        { upsert: true }
      )
    },
    async topupByPaymentIntent(paymentIntent) {
      const p = await purchases().findOne({ paymentIntent })
      return p
        ? {
            sessionId: p._id,
            userId: p.userId,
            credits: p.credits,
            amount: p.amount,
            clawed: p.clawed,
          }
        : null
    },
    async setClawed(sessionId, clawed) {
      await purchases().updateOne({ _id: sessionId }, { $max: { clawed } })
    },
    clawback: (userId, credits, refId) =>
      clawbackTopup(new ObjectId(userId), credits, refId),
    resetSubscription: (userId, allowance, invoiceId) =>
      resetSubscriptionCredits(new ObjectId(userId), allowance, invoiceId),
    async setPlan(userId, plan, renewsAt, subscriptionId) {
      await users().updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            plan,
            planRenewsAt: renewsAt,
            stripeSubscriptionId: subscriptionId,
          },
        }
      )
    },
    async sendTopupReceipt(userId, credits) {
      const u = await users().findOne(
        { _id: new ObjectId(userId) },
        { projection: { email: 1 } }
      )
      if (!u?.email) return
      const balance = await balanceOf(userId)
      await sendCreditsAdded(
        u.email,
        credits,
        balance.subscription + balance.topup,
        `${env().APP_URL.replace(/\/$/, "")}/account/billing`
      ).catch((error: unknown) =>
        console.error("[stripe] receipt email failed", String(error))
      )
    },
    log: (message, data) => console.warn(message, data ?? {}),
  }
}
