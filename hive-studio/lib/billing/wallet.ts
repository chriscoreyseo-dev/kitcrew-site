import "server-only"

import { ObjectId } from "mongodb"

import { formatCredits } from "@/lib/credits-format"
import { db } from "@/lib/db/mongo"
import type { GenerationDoc } from "@/lib/generations/model"
import type { Surface } from "@/generation/catalog/types"
import {
  walletDebit,
  walletSnapshot,
  walletRefund,
  WalletDeclinedError,
  WalletUnavailableError,
} from "@/lib/markethive/wallet"
import { isMarketHive } from "@/lib/mode"

import {
  balanceOf,
  InsufficientCreditsError,
  insertChargedGeneration,
} from "./ledger"
import type { Credits } from "./ledger"
import { planOf } from "./plans"

/** One charge path per deployment (D-057). Standalone debits our own ledger
    inside the insert transaction. MarketHive mode inserts the run first (the
    same transaction still enforces the parallel limit), then asks MarketHive
    to debit it by generation id; MarketHive is the ledger of record. */

type MarketHiveUser = { _id: ObjectId; markethive?: { memberId?: number } }

export async function memberIdOf(userId: ObjectId): Promise<number> {
  const user = await db()
    .collection<MarketHiveUser>("users")
    .findOne({ _id: userId }, { projection: { markethive: 1 } })
  const memberId = user?.markethive?.memberId
  if (!memberId) throw new Error("Account is not linked to MarketHive")
  return memberId
}

/** Runs a MarketHive member may have going at once, per surface (D-057).
    Starter-plan limits: MarketHive members have no studio plan. */
export const MARKETHIVE_CONCURRENCY: Record<Surface, number> = {
  image: 4,
  video: 2,
  audio: 2,
}

export function parallelLimitFor(plan: unknown, surface: Surface): number {
  return isMarketHive()
    ? MARKETHIVE_CONCURRENCY[surface]
    : planOf(plan).concurrency[surface]
}

/** The balance shown to the user, in the deployment's unit. MarketHive mode
    reads MarketHive's wallet live (it is the ledger of record). */
export async function balanceFor(
  userId: string
): Promise<Credits & { plan: string }> {
  if (!isMarketHive()) return balanceOf(userId)
  const snap = await walletSnapshot(await memberIdOf(new ObjectId(userId)))
  return { subscription: 0, topup: snap.balance, plan: "markethive" }
}

export async function chargeAndInsert(
  doc: GenerationDoc,
  cost: number,
  parallelLimit: number
): Promise<GenerationDoc> {
  if (!isMarketHive()) return insertChargedGeneration(doc, cost, parallelLimit)

  const memberId = await memberIdOf(doc.userId)
  // Cost 0 in our ledger: the transaction only checks the parallel limit and
  // inserts the run, marked as waiting on MarketHive's debit.
  const pending = await insertChargedGeneration(
    { ...doc, wallet: { kind: "markethive", memberId, state: "debiting" } },
    0,
    parallelLimit
  )
  const ref = pending._id.toHexString()
  const runs = db().collection<GenerationDoc>("generations")
  try {
    const { charged } = await walletDebit({
      memberId,
      ref,
      surface: doc.surface,
      model: doc.modelId,
      amountCents: cost,
    })
    await runs.updateOne(
      { _id: pending._id },
      { $set: { cost: charged, "wallet.state": "debited" } }
    )
    return {
      ...pending,
      cost: charged,
      wallet: { kind: "markethive", memberId, state: "debited" },
    }
  } catch (error) {
    if (error instanceof WalletDeclinedError) {
      // A definite no: nothing was debited and nothing ran. Leave no trace.
      await runs.deleteOne({ _id: pending._id })
      if (error.code === "insufficient")
        throw new InsufficientCreditsError(
          cost,
          error.balance ?? 0,
          error.balance !== undefined
            ? `Not enough Hive credits. Your balance is ${formatCredits(error.balance, "hive")}.`
            : "Not enough Hive credits."
        )
      throw error
    }
    // Unclear (timeout, MarketHive down): the debit may have landed. Fail the
    // run and refund by reference; MarketHive refunds only a real debit.
    const at = new Date()
    await runs.updateOne(
      { _id: pending._id },
      {
        $set: {
          status: "failed",
          error:
            "Couldn't confirm the charge with MarketHive. Any charge is refunded automatically.",
          walletRefundPending: true,
          updatedAt: at,
          finishedAt: at,
        },
      }
    )
    await retryWalletRefund({ _id: pending._id, wallet: pending.wallet })
    throw error instanceof WalletUnavailableError
      ? error
      : new WalletUnavailableError(String(error))
  }
}

/** Refund a MarketHive-paid run. Never throws: a refund MarketHive couldn't
    take is flagged and retried by the reconciler. */
export async function refundMarketHive(
  doc: Pick<GenerationDoc, "_id" | "wallet">
): Promise<void> {
  const runs = db().collection<GenerationDoc>("generations")
  await runs.updateOne(
    { _id: doc._id },
    { $set: { walletRefundPending: true } }
  )
  await retryWalletRefund(doc)
}

export async function retryWalletRefund(
  doc: Pick<GenerationDoc, "_id" | "wallet">
): Promise<boolean> {
  if (!doc.wallet) return false
  try {
    await walletRefund({
      memberId: doc.wallet.memberId,
      ref: doc._id.toHexString(),
    })
  } catch (error) {
    console.warn("[wallet] refund not delivered yet", {
      id: doc._id.toHexString(),
      error: String(error),
    })
    return false
  }
  await db()
    .collection<GenerationDoc>("generations")
    .updateOne({ _id: doc._id }, { $unset: { walletRefundPending: "" } })
  return true
}
