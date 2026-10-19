import type { Collection, ObjectId } from "mongodb"

import type { MediaKind, MediaRole, Surface } from "@/generation/catalog/types"
import type { OutputKind } from "@/lib/higgsfield/types"

export type GenerationStatus =
  | "pending_submit"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled"

export const IN_FLIGHT: GenerationStatus[] = [
  "pending_submit",
  "queued",
  "in_progress",
]
export const TERMINAL: GenerationStatus[] = [
  "completed",
  "failed",
  "nsfw",
  "canceled",
]

export type GenerationOutput = {
  kind: OutputKind
  /** What the app serves: R2 public URL (platform URL only in dev without R2). */
  url: string
  r2Key?: string
  contentType?: string
  bytes?: number
}

export type GenerationDoc = {
  _id: ObjectId
  userId: ObjectId
  /** Client-generated per submit; unique per user, so a double click can't create two runs. */
  clientRequestId: string
  projectId?: string
  surface: Surface
  modelId: string
  modelLabel: string
  modelPath: string
  inputMode?: string
  prompt: string
  settings: Record<string, unknown>
  media: Array<{
    role: MediaRole
    kind?: MediaKind
    url: string
    name?: string
  }>
  status: GenerationStatus
  hfRequestId?: string
  /** Credits debited for this run. */
  cost: number
  /** Which buckets the debit came from; refunds go back the same way. */
  costSplit?: { subscription: number; topup: number }
  /** markethive mode: the charge lives in MarketHive's wallet, keyed by this
      generation's id (D-057). `cost` is then in Hive-credit cents. */
  wallet?: {
    kind: "markethive"
    memberId: number
    state: "debiting" | "debited"
  }
  /** A MarketHive refund that couldn't be delivered yet; the reconciler retries. */
  walletRefundPending?: boolean
  outputs: GenerationOutput[]
  error?: string
  /** Width / height for the feed before media loads. */
  aspect: number
  isPublic: boolean
  publishedAt?: Date
  /** The owner had Auto-publish on at submit (D-065): finalize publishes the
      run to Community the moment it completes. Never set on failed runs. */
  autoPublish?: boolean
  /** Set when the owner clicks Share (S581): the run's files become public and
      it gets a MarketHive share page (lib/sharing.ts). */
  sharedAt?: Date
  presetId?: string
  createdAt: Date
  updatedAt: Date
  /** Last time the platform status was fetched. */
  checkedAt?: Date
  finishedAt?: Date
  /** Lease so two finalizers never copy/settle the same run at once. */
  finalizingUntil?: Date
}

/** What the browser sees. Kept in the shape of the template's RunRecord. */
export type RunDTO = {
  id: string
  surface: Surface
  modelId: string
  modelLabel: string
  prompt: string
  settings: Record<string, unknown>
  projectId?: string
  aspect: number
  status: "running" | "completed" | "failed"
  /** Fine-grained status for labels and the Cancel button. */
  phase: GenerationStatus
  urls: string[]
  error?: string
  /** Published to Community. */
  isPublic: boolean
  createdAt: number
}

export function toRunDTO(doc: GenerationDoc): RunDTO {
  const running = IN_FLIGHT.includes(doc.status)
  return {
    id: doc._id.toHexString(),
    surface: doc.surface,
    modelId: doc.modelId,
    modelLabel: doc.modelLabel,
    prompt: doc.prompt,
    settings: doc.settings,
    ...(doc.projectId ? { projectId: doc.projectId } : {}),
    aspect: doc.aspect,
    status: running
      ? "running"
      : doc.status === "completed"
        ? "completed"
        : "failed",
    phase: doc.status,
    urls: doc.status === "completed" ? doc.outputs.map((o) => o.url) : [],
    ...(doc.error ? { error: doc.error } : {}),
    isPublic: doc.isPublic === true,
    createdAt: doc.createdAt.getTime(),
  }
}

export type GenerationsCollection = Collection<GenerationDoc>

/** Parses "16:9" / "9:16" / "1:1" style values; 1 when unknown. */
export function aspectFromSettings(settings: Record<string, unknown>): number {
  const raw = settings.aspect_ratio ?? settings.aspectRatio ?? settings.ratio
  if (typeof raw !== "string") return 1
  const [w, h] = raw.split(/[:x/]/).map(Number)
  return w && h ? w / h : 1
}

/** Plain-language failure labels shown on tiles. */
export const FAILURE_MESSAGES = {
  nsfw: "Blocked by content filter. Credits refunded.",
  canceled: "Canceled. Credits refunded.",
  failed: "Generation failed. Credits refunded.",
  noMedia: "The model returned no media. Credits refunded.",
  unconfirmed: "We couldn't confirm the job started. Credits refunded.",
  timedOut: "Timed out. Credits refunded.",
} as const

export function platformErrorText(error: unknown): string | undefined {
  if (typeof error === "string" && error.trim())
    return error.trim().slice(0, 300)
  if (error && typeof error === "object") {
    const detail =
      (error as { detail?: unknown }).detail ??
      (error as { message?: unknown }).message
    if (typeof detail === "string" && detail.trim())
      return detail.trim().slice(0, 300)
  }
  return undefined
}
