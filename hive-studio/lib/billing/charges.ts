import "server-only"

import type { GenerationDoc } from "@/lib/generations/model"

import { refundGenerationCredits } from "./ledger"

/** Called exactly once per terminal failure (see settleRefund); the ledger's
    unique key makes a replay a no-op anyway. */
export async function refundGeneration(
  doc: Pick<GenerationDoc, "_id" | "userId" | "cost" | "costSplit">
): Promise<void> {
  await refundGenerationCredits(doc)
}
