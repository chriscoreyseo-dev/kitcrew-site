import "server-only"

import { MongoServerError, ObjectId } from "mongodb"
import type { ClientSession } from "mongodb"

import type { Surface } from "@/generation/catalog/types"
import { db, mongoClient } from "@/lib/db/mongo"
import type { GenerationDoc } from "@/lib/generations/model"
import { IN_FLIGHT } from "@/lib/generations/model"

/** Append-only credit ledger. A balance only changes inside a transaction that
    also inserts its ledger row; the unique {reason, refType, refId} index turns
    any replay (webhook retry, double finalize, double event) into a no-op.
    Balances never go below zero: debits are conditional on the exact balance
    read in the same transaction. */

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

export type Credits = { subscription: number; topup: number }

type UserBilling = {
  _id: ObjectId
  credits?: Partial<Credits>
  plan?: string
  lastSubmitAt?: Date
  billingFlag?: string
}

export class InsufficientCreditsError extends Error {
  constructor(
    readonly needed: number,
    readonly available: number
  ) {
    super(`This needs ${needed} credits and you have ${available}.`)
    this.name = "InsufficientCreditsError"
  }
}

export class ConcurrencyLimitError extends Error {
  constructor(
    readonly limit: number,
    surface: Surface
  ) {
    super(
      `Your plan runs ${limit} ${surface} generation${limit === 1 ? "" : "s"} at a time. Wait for one to finish.`
    )
    this.name = "ConcurrencyLimitError"
  }
}

const DUPLICATE_KEY = 11000
const users = () => db().collection<UserBilling>("users")
const ledger = () => db().collection<LedgerEntry>("credit_ledger")
const generations = () => db().collection<GenerationDoc>("generations")

export function creditsOf(user: Pick<UserBilling, "credits"> | null): Credits {
  return {
    subscription: Math.max(0, user?.credits?.subscription ?? 0),
    topup: Math.max(0, user?.credits?.topup ?? 0),
  }
}

/** Spend subscription credits first, then top-up credits. */
export function splitDebit(credits: Credits, cost: number): Credits | null {
  if (credits.subscription + credits.topup < cost) return null
  const subscription = Math.min(credits.subscription, cost)
  return { subscription, topup: cost - subscription }
}

/** Matches an exact stored balance; 0 also matches a missing field. */
const exactly = (value: number) => (value === 0 ? { $in: [0, null] } : value)

function isDuplicate(error: unknown): boolean {
  return error instanceof MongoServerError
    ? error.code === DUPLICATE_KEY
    : (error as { code?: unknown })?.code === DUPLICATE_KEY
}

async function inTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = mongoClient().startSession()
  try {
    let result: T | undefined
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result as T
  } finally {
    await session.endSession()
  }
}

/** Debit `cost`, enforce the plan's parallel limit and insert the generation,
    all-or-nothing. Returns the generation as stored (with cost + split). */
export async function insertChargedGeneration(
  doc: GenerationDoc,
  cost: number,
  parallelLimit: number
): Promise<GenerationDoc> {
  return inTransaction(async (session) => {
    const gid = doc._id.toHexString()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const user = await users().findOne({ _id: doc.userId }, { session })
      if (!user) throw new Error("User not found")
      const inFlight = await generations().countDocuments(
        {
          userId: doc.userId,
          surface: doc.surface,
          status: { $in: IN_FLIGHT },
        },
        { session }
      )
      if (inFlight >= parallelLimit)
        throw new ConcurrencyLimitError(parallelLimit, doc.surface)
      const balance = creditsOf(user)
      const split = splitDebit(balance, cost)
      if (!split)
        throw new InsufficientCreditsError(
          cost,
          balance.subscription + balance.topup
        )
      // Touching the user document on every submit (even at cost 0) makes
      // concurrent submits for one user conflict, so the in-flight count holds.
      const updated = await users().updateOne(
        {
          _id: doc.userId,
          "credits.subscription": exactly(user.credits?.subscription ?? 0),
          "credits.topup": exactly(user.credits?.topup ?? 0),
        },
        {
          $inc: {
            "credits.subscription": -split.subscription,
            "credits.topup": -split.topup,
          },
          $set: { lastSubmitAt: new Date() },
        },
        { session }
      )
      if (!updated.matchedCount) continue // balance moved under us: re-read
      const after = balance.subscription + balance.topup - cost
      const now = new Date()
      for (const bucket of ["subscription", "topup"] as const)
        if (split[bucket] > 0)
          await ledger().insertOne(
            {
              userId: doc.userId,
              delta: -split[bucket],
              bucket,
              reason: "generation_debit",
              refType: "generation",
              refId: `${gid}:${bucket}`,
              balanceAfter: after,
              createdAt: now,
            },
            { session }
          )
      const charged: GenerationDoc = { ...doc, cost, costSplit: split }
      await generations().insertOne(charged, { session })
      return charged
    }
    throw new Error("Your balance is changing too fast. Try again.")
  })
}

/** One ledger row + its balance change, idempotent on (reason, refType, refId).
    Returns false when this exact entry was already applied. */
export async function applyLedgerEntry(input: {
  userId: ObjectId
  delta: number
  bucket: Bucket
  reason: LedgerReason
  refType: string
  refId: string
  note?: string
  /** Set the bucket to this value instead of adding delta (subscription reset). */
  setTo?: number
  flag?: string
}): Promise<boolean> {
  try {
    await inTransaction(async (session) => {
      const user = await users().findOne({ _id: input.userId }, { session })
      if (!user) throw new Error(`No user ${input.userId.toHexString()}`)
      const before = creditsOf(user)
      const delta =
        input.setTo !== undefined
          ? input.setTo - before[input.bucket]
          : input.delta
      const nextBucket = Math.max(0, before[input.bucket] + delta)
      const applied = nextBucket - before[input.bucket]
      const after = { ...before, [input.bucket]: nextBucket }
      await ledger().insertOne(
        {
          userId: input.userId,
          delta: applied,
          bucket: input.bucket,
          reason: input.reason,
          refType: input.refType,
          refId: input.refId,
          balanceAfter: after.subscription + after.topup,
          ...(input.note ? { note: input.note } : {}),
          createdAt: new Date(),
        },
        { session }
      )
      await users().updateOne(
        { _id: input.userId },
        {
          $set: {
            [`credits.${input.bucket}`]: nextBucket,
            ...(input.flag ? { billingFlag: input.flag } : {}),
          },
        },
        { session }
      )
    })
    return true
  } catch (error) {
    if (isDuplicate(error)) return false
    throw error
  }
}

export type GrantInput = {
  userId: string
  amount: number
  bucket: Bucket
  reason: LedgerReason
  refType: string
  refId: string
  note?: string
}

/** Add `amount` (> 0) credits. Returns false when this grant already happened. */
export async function grantCredits(input: GrantInput): Promise<boolean> {
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new Error("grantCredits: amount must be a positive integer")
  return applyLedgerEntry({
    ...input,
    userId: new ObjectId(input.userId),
    delta: input.amount,
  })
}

/** Return a failed run's credits to the buckets they came from, once. */
export async function refundGenerationCredits(
  doc: Pick<GenerationDoc, "_id" | "userId" | "cost" | "costSplit">
): Promise<void> {
  if (!doc.cost) return
  const split = doc.costSplit ?? { subscription: 0, topup: doc.cost }
  const gid = doc._id.toHexString()
  for (const bucket of ["subscription", "topup"] as const)
    if (split[bucket] > 0)
      await applyLedgerEntry({
        userId: doc.userId,
        delta: split[bucket],
        bucket,
        reason: "generation_refund",
        refType: "generation",
        refId: `${gid}:${bucket}`,
      })
}

/** Paid invoice: the subscription bucket becomes the plan allowance (reset, not added). */
export async function resetSubscriptionCredits(
  userId: ObjectId,
  allowance: number,
  invoiceId: string
): Promise<boolean> {
  return applyLedgerEntry({
    userId,
    delta: 0,
    setTo: allowance,
    bucket: "subscription",
    reason: "subscription_reset",
    refType: "invoice",
    refId: invoiceId,
  })
}

/** Refunded top-up: take back up to `credits` (never below zero) and flag for review. */
export async function clawbackTopup(
  userId: ObjectId,
  credits: number,
  refId: string
): Promise<boolean> {
  return applyLedgerEntry({
    userId,
    delta: -Math.abs(credits),
    bucket: "topup",
    reason: "stripe_refund",
    refType: "charge",
    refId,
    flag: "refund_review",
  })
}

export async function balanceOf(
  userId: string
): Promise<Credits & { plan: string }> {
  const user = await users().findOne(
    { _id: new ObjectId(userId) },
    { projection: { credits: 1, plan: 1 } }
  )
  return { ...creditsOf(user), plan: user?.plan ?? "free" }
}
