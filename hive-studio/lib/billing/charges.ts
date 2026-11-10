import "server-only"

import type { GenerationDoc } from "@/lib/generations/model"

import { refundGenerationCredits } from "./ledger"
import { refundMarketHive } from "./wallet"

/** Called exactly once per terminal failure (see settleRefund); the ledger's
    unique key (or MarketHive's per-ref refund) makes a replay a no-op anyway.
    The run's own record says which wallet paid, not the current mode. */
export async function refundGeneration(
  doc: Pick<GenerationDoc, "_id" | "userId" | "cost" | "costSplit" | "wallet">
): Promise<void> {
  if (doc.wallet?.kind === "markethive") return refundMarketHive(doc)
  await refundGenerationCredits(doc)
}
