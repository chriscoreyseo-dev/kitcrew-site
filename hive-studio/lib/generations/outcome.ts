import type { GenerationStatus as PlatformStatusPayload } from "@/lib/higgsfield/types"
import { outputsOf } from "@/lib/higgsfield/types"
import { isAllowedOutputUrl } from "@/lib/storage/keys"

import { FAILURE_MESSAGES, platformErrorText } from "./model"
import type { GenerationStatus } from "./model"

/** What a platform status means for our document. Pure, unit-tested. */
export type Outcome =
  | { kind: "pending"; status: "queued" | "in_progress" }
  | {
      kind: "completed"
      outputs: Array<{ kind: "image" | "video" | "audio"; url: string }>
    }
  | {
      kind: "refund"
      status: Extract<GenerationStatus, "failed" | "nsfw" | "canceled">
      error: string
    }

export function outcomeOf(payload: PlatformStatusPayload): Outcome {
  switch (payload.status) {
    case "queued":
    case "in_progress":
      return { kind: "pending", status: payload.status }
    case "completed": {
      const outputs = outputsOf(payload).filter((o) =>
        isAllowedOutputUrl(o.url)
      )
      return outputs.length
        ? { kind: "completed", outputs }
        : { kind: "refund", status: "failed", error: FAILURE_MESSAGES.noMedia }
    }
    case "nsfw":
      return { kind: "refund", status: "nsfw", error: FAILURE_MESSAGES.nsfw }
    case "canceled":
      return {
        kind: "refund",
        status: "canceled",
        error: FAILURE_MESSAGES.canceled,
      }
    case "failed": {
      const detail = platformErrorText(payload.error)
      return {
        kind: "refund",
        status: "failed",
        error: detail ? `${detail} Credits refunded.` : FAILURE_MESSAGES.failed,
      }
    }
    default:
      // An unknown status is treated as still running; the 15-minute cap ends it.
      return { kind: "pending", status: "in_progress" }
  }
}

/** Submit errors that prove the job was not created (refund now) vs. unclear
    ones (leave pending_submit for the reconciler). */
export function submitFailureIsDefinite(status: number | undefined): boolean {
  return status !== undefined && status >= 400 && status < 500
}
