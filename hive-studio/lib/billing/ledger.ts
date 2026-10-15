import "server-only"

import { MongoServerError, ObjectId } from "mongodb"

import { db, mongoClient } from "@/lib/db/mongo"

/** Append-only credit ledger. A balance only changes inside a transaction that
    also inserts its ledger row; the unique {reason, refType, refId} index turns
    a replayed grant (webhook retry, double event) into a no-op.
    Phase 5 adds debits/refunds and the subscription reset on top of this. */

export type Bucket = "subscription" | "topup"

export type LedgerReason =
  | "generation_debit"
  | "generation_refund"
  | "subscription_grant"
  | "subscription_reset"
  | "topup_purchase"
  | "signup_bonus"
  | "admin_adjust"
  | "stripe_refund"

export type LedgerEntry = {
  userId: ObjectId
  delta: number
  bucket: Bucket
  reason: LedgerReason
  refType: string
  refId: string
  balanceAfter: number
  note?: string
  createdAt: Date
}

type UserCredits = { credits?: { subscription?: number; topup?: number } }

export type GrantInput = {
  userId: string
  amount: number
  bucket: Bucket
  reason: LedgerReason
  refType: string
  refId: string
  note?: string
}

const DUPLICATE_KEY = 11000

/** Add `amount` (> 0) credits. Returns false when this grant already happened. */
export async function grantCredits(input: GrantInput): Promise<boolean> {
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new Error("grantCredits: amount must be a positive integer")
  const userId = new ObjectId(input.userId)
  const session = mongoClient().startSession()
  try {
    await session.withTransaction(async () => {
      const users = db().collection<UserCredits & { _id: ObjectId }>("users")
      const updated = await users.findOneAndUpdate(
        { _id: userId },
        { $inc: { [`credits.${input.bucket}`]: input.amount } },
        { session, returnDocument: "after" }
      )
      if (!updated) throw new Error(`grantCredits: no user ${input.userId}`)
      const balanceAfter =
        (updated.credits?.subscription ?? 0) + (updated.credits?.topup ?? 0)
      await db()
        .collection<LedgerEntry>("credit_ledger")
        .insertOne(
          {
            userId,
            delta: input.amount,
            bucket: input.bucket,
            reason: input.reason,
            refType: input.refType,
            refId: input.refId,
            balanceAfter,
            ...(input.note ? { note: input.note } : {}),
            createdAt: new Date(),
          },
          { session }
        )
    })
    return true
  } catch (error) {
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY)
      return false
    throw error
  } finally {
    await session.endSession()
  }
}
