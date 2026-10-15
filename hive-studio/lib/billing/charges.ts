import "server-only"

import type { GenerationDoc } from "@/lib/generations/model"

/** Credit hooks for the generation lifecycle. Phase 3 runs at cost 0; Phase 5
    implements pricing (lib/billing/price.ts), the transactional debit inside
    submit, and this refund through the ledger (reason generation_refund,
    refId = generation id, so a replayed refund is a no-op). */
export async function refundGeneration(
  doc: Pick<GenerationDoc, "_id" | "cost">
): Promise<void> {
  if (doc.cost === 0) return
  throw new Error(
    `Refund not implemented yet for generation ${doc._id.toHexString()}`
  )
}
