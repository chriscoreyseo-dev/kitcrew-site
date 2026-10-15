import "server-only"

import { ObjectId } from "mongodb"

import { getModel, parseSettings } from "@/generation/catalog"
import type { GenerationPlane } from "@/generation/catalog/types"
import { toPlatform } from "@/generation/to-platform"
import { refundGeneration } from "@/lib/billing/charges"
import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"
import { platform, PlatformError } from "@/lib/higgsfield"
import { projectBelongsTo, uploads } from "@/lib/library"
import { PlatformUnreachableError } from "@/lib/higgsfield/platform"
import { webhookUrlFor } from "@/lib/higgsfield/webhook"
import { copyToR2, deleteFromR2, isR2Configured } from "@/lib/storage/r2"

import {
  aspectFromSettings,
  FAILURE_MESSAGES,
  IN_FLIGHT,
  TERMINAL,
} from "./model"
import type { GenerationDoc, GenerationOutput } from "./model"
import { outcomeOf, submitFailureIsDefinite } from "./outcome"

const LEASE_MS = 90_000
export const PENDING_SUBMIT_GRACE_MS = 2 * 60_000
export const RUN_DEADLINE_MS = 15 * 60_000
/** Phase 5 replaces this with the per-plan parallel limit, checked in the debit transaction. */
export const MAX_IN_FLIGHT = 4

export class GenerationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GenerationInputError"
  }
}

export class GenerationNotFoundError extends Error {
  constructor() {
    super("Generation not found.")
    this.name = "GenerationNotFoundError"
  }
}

export function generations() {
  return db().collection<GenerationDoc>("generations")
}

function webhookEnv() {
  const e = env()
  return {
    HF_WEBHOOK_BASE_URL: e.HF_WEBHOOK_BASE_URL,
    HF_WEBHOOK_SECRET: e.HF_WEBHOOK_SECRET,
  }
}

export function webhooksEnabled(): boolean {
  const e = webhookEnv()
  return Boolean(e.HF_WEBHOOK_BASE_URL && e.HF_WEBHOOK_SECRET)
}

/** Every media URL must be the user's own upload or the user's own output.
    The browser never chooses what the platform fetches. */
async function assertMediaOwned(
  userId: ObjectId,
  urls: string[]
): Promise<void> {
  const unique = [...new Set(urls)]
  if (!unique.length) return
  const [ownedUploads, outputs] = await Promise.all([
    uploads()
      .find(
        { userId, status: "ready", publicUrl: { $in: unique } },
        { projection: { publicUrl: 1 } }
      )
      .toArray(),
    generations()
      .find(
        { userId, status: "completed", "outputs.url": { $in: unique } },
        { projection: { outputs: 1 } }
      )
      .toArray(),
  ])
  const owned = new Set<string>([
    ...ownedUploads.map((u) => u.publicUrl),
    ...outputs.flatMap((g) => g.outputs.map((o) => o.url)),
  ])
  if (unique.some((url) => !owned.has(url)))
    throw new GenerationInputError(
      "One of the references isn't in your library. Re-add it and try again."
    )
}

export type SubmitInput = {
  userId: string
  plane: GenerationPlane
  projectId?: string
  clientRequestId: string
}

/** Validate → insert pending_submit → call the platform → queued.
    Phase 5 wraps the insert in a transaction with the credit debit. */
export async function submitGeneration(
  input: SubmitInput
): Promise<GenerationDoc> {
  const userId = new ObjectId(input.userId)
  const existing = await generations().findOne({
    userId,
    clientRequestId: input.clientRequestId,
  })
  if (existing) return existing

  let model
  try {
    model = getModel(input.plane.model)
  } catch {
    throw new GenerationInputError("That model isn't available.")
  }
  const plane: GenerationPlane = {
    ...input.plane,
    model: model.id,
    settings: parseSettings(model, input.plane.settings),
  }
  let request
  try {
    request = toPlatform(plane)
  } catch (error) {
    throw new GenerationInputError(
      error instanceof Error ? error.message : "Invalid request."
    )
  }
  const media = Object.values(plane.media).flatMap((items) => items ?? [])
  await assertMediaOwned(
    userId,
    media.map((m) => m.url)
  )

  if (input.projectId && !(await projectBelongsTo(userId, input.projectId)))
    throw new GenerationInputError("That project no longer exists.")

  const inFlight = await generations().countDocuments({
    userId,
    status: { $in: IN_FLIGHT },
  })
  if (inFlight >= MAX_IN_FLIGHT)
    throw new GenerationInputError(
      `You can run ${MAX_IN_FLIGHT} generations at once. Wait for one to finish.`
    )

  const now = new Date()
  const doc: GenerationDoc = {
    _id: new ObjectId(),
    userId,
    clientRequestId: input.clientRequestId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    surface: model.surface,
    modelId: model.id,
    modelLabel: model.label,
    modelPath: request.path,
    ...(plane.inputMode ? { inputMode: plane.inputMode } : {}),
    prompt: plane.prompt.text,
    settings: plane.settings,
    media: media.map((m) => ({
      role: m.role,
      url: m.url,
      ...(m.kind ? { kind: m.kind } : {}),
      ...(m.name ? { name: m.name.slice(0, 120) } : {}),
    })),
    status: "pending_submit",
    cost: 0,
    outputs: [],
    aspect: aspectFromSettings(plane.settings),
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  }
  try {
    await generations().insertOne(doc)
  } catch (error) {
    // Lost a double-click race on {userId, clientRequestId}: return the winner.
    const winner = await generations().findOne({
      userId,
      clientRequestId: input.clientRequestId,
    })
    if (winner) return winner
    throw error
  }

  const id = doc._id.toHexString()
  try {
    const queued = await platform().submit(
      request.path,
      request.body,
      webhookUrlFor(id, webhookEnv())
    )
    const at = new Date()
    await generations().updateOne(
      { _id: doc._id, status: "pending_submit" },
      {
        $set: {
          status: "queued",
          hfRequestId: queued.requestId,
          updatedAt: at,
          checkedAt: at,
        },
      }
    )
    return {
      ...doc,
      status: "queued",
      hfRequestId: queued.requestId,
      updatedAt: at,
      checkedAt: at,
    }
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : undefined
    if (submitFailureIsDefinite(status)) {
      const message =
        status === 422 || status === 400
          ? `The model rejected these settings: ${(error as Error).message}`
          : "Couldn't start the generation. Credits refunded."
      return settleRefund(doc, "failed", message)
    }
    if (
      error instanceof PlatformError ||
      error instanceof PlatformUnreachableError
    ) {
      // Unclear: the job may exist. Leave pending_submit for the reconciler.
      console.warn("[generation] submit outcome unclear", { id, status })
      return doc
    }
    // Our own bug or config error before the platform saw anything.
    await settleRefund(
      doc,
      "failed",
      "Couldn't start the generation. Credits refunded."
    )
    throw error
  }
}

async function settleRefund(
  doc: GenerationDoc,
  status: "failed" | "nsfw" | "canceled",
  error: string
): Promise<GenerationDoc> {
  const at = new Date()
  const result = await generations().findOneAndUpdate(
    { _id: doc._id, status: { $in: IN_FLIGHT } },
    {
      $set: { status, error, updatedAt: at, finishedAt: at },
      $unset: { finalizingUntil: "" },
    },
    { returnDocument: "after" }
  )
  // Only the caller that made the transition refunds (exactly once).
  if (result) await refundGeneration(result)
  return result ?? (await generations().findOne({ _id: doc._id })) ?? doc
}

/** Idempotent. Called by the webhook, the reconciler and refresh. */
export async function finalizeGeneration(
  id: ObjectId
): Promise<"skipped" | "pending" | "settled"> {
  const now = new Date()
  const doc = await generations().findOneAndUpdate(
    {
      _id: id,
      status: { $in: ["queued", "in_progress"] },
      hfRequestId: { $exists: true },
      $or: [
        { finalizingUntil: { $exists: false } },
        { finalizingUntil: { $lt: now } },
      ],
    },
    { $set: { finalizingUntil: new Date(now.getTime() + LEASE_MS) } },
    { returnDocument: "after" }
  )
  if (!doc?.hfRequestId) return "skipped"

  try {
    const outcome = outcomeOf(await platform().status(doc.hfRequestId))
    const at = new Date()
    if (outcome.kind === "pending") {
      await generations().updateOne(
        { _id: id, status: { $in: ["queued", "in_progress"] } },
        {
          $set: { status: outcome.status, checkedAt: at, updatedAt: at },
          $unset: { finalizingUntil: "" },
        }
      )
      return "pending"
    }
    if (outcome.kind === "refund") {
      await settleRefund(doc, outcome.status, outcome.error)
      return "settled"
    }
    const outputs = await storeOutputs(doc, outcome.outputs)
    await generations().updateOne(
      { _id: id, status: { $in: ["queued", "in_progress"] } },
      {
        $set: {
          status: "completed",
          outputs,
          checkedAt: at,
          updatedAt: at,
          finishedAt: at,
        },
        $unset: { finalizingUntil: "", error: "" },
      }
    )
    return "settled"
  } catch (error) {
    await generations().updateOne(
      { _id: id },
      { $unset: { finalizingUntil: "" }, $set: { checkedAt: new Date() } }
    )
    throw error
  }
}

async function storeOutputs(
  doc: GenerationDoc,
  outputs: Array<{ kind: "image" | "video" | "audio"; url: string }>
): Promise<GenerationOutput[]> {
  if (!isR2Configured()) {
    if (process.env.NODE_ENV === "production")
      throw new Error("R2 is not configured")
    console.warn(
      "[generation] R2 not configured; keeping platform URLs (dev only, expire in ~7 days)"
    )
    return outputs.map((o) => ({ kind: o.kind, url: o.url }))
  }
  const stored: GenerationOutput[] = []
  for (const [index, output] of outputs.entries()) {
    const copy = await copyToR2({
      sourceUrl: output.url,
      userId: doc.userId.toHexString(),
      generationId: doc._id.toHexString(),
      index,
      kind: output.kind,
    })
    stored.push({
      kind: output.kind,
      url: copy.url,
      r2Key: copy.key,
      contentType: copy.contentType,
      bytes: copy.bytes,
    })
  }
  return stored
}

export type CancelResult = "canceled" | "already_started" | "already_finished"

/** Really cancels on the platform (queued only); never fakes it client-side. */
export async function cancelGeneration(
  userId: string,
  id: string
): Promise<CancelResult> {
  const doc = await findOwned(userId, id)
  if (TERMINAL.includes(doc.status)) return "already_finished"
  if (doc.status === "in_progress") return "already_started"
  if (doc.status === "pending_submit" || !doc.hfRequestId)
    return "already_started"
  try {
    await platform().cancel(doc.hfRequestId)
  } catch (error) {
    if (error instanceof PlatformError && error.status === 400) {
      await generations().updateOne(
        { _id: doc._id, status: "queued" },
        { $set: { status: "in_progress", updatedAt: new Date() } }
      )
      return "already_started"
    }
    throw error
  }
  // Settle from the platform's own answer (it now reports "canceled").
  await finalizeGeneration(doc._id).catch(() => undefined)
  const after = await generations().findOne({ _id: doc._id })
  if (after && IN_FLIGHT.includes(after.status))
    await settleRefund(after, "canceled", FAILURE_MESSAGES.canceled)
  return "canceled"
}

export async function findOwned(
  userId: string,
  id: string
): Promise<GenerationDoc> {
  if (!ObjectId.isValid(id)) throw new GenerationNotFoundError()
  const doc = await generations().findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  })
  // Someone else's id looks exactly like a missing one.
  if (!doc) throw new GenerationNotFoundError()
  return doc
}

export async function deleteGeneration(
  userId: string,
  id: string
): Promise<void> {
  const doc = await findOwned(userId, id)
  if (IN_FLIGHT.includes(doc.status))
    throw new GenerationInputError(
      "Cancel or wait for this generation before deleting it."
    )
  await generations().deleteOne({ _id: doc._id, userId: doc.userId })
  const keys = doc.outputs.flatMap((o) => (o.r2Key ? [o.r2Key] : []))
  if (keys.length)
    await deleteFromR2(keys).catch((error: unknown) =>
      console.error("[generation] R2 delete failed", {
        id,
        error: String(error),
      })
    )
}

export type ReconcileReport = {
  unconfirmed: number
  checked: number
  timedOut: number
  errors: number
}

/** Cron (every minute) and the dev poller. Bounded per run. */
export async function reconcile(now = Date.now()): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    unconfirmed: 0,
    checked: 0,
    timedOut: 0,
    errors: 0,
  }
  const col = generations()

  // 1. Submits whose outcome we never learned. With no lookup by our id on the
  //    platform, we can't prove a job exists, so the user is refunded.
  for (const doc of await col
    .find({
      status: "pending_submit",
      createdAt: { $lt: new Date(now - PENDING_SUBMIT_GRACE_MS) },
    })
    .limit(50)
    .toArray()) {
    await settleRefund(doc, "failed", FAILURE_MESSAGES.unconfirmed)
    report.unconfirmed += 1
  }

  // 2. In-flight runs not checked recently (webhook is primary when configured).
  const staleMs = webhooksEnabled() ? 3 * 60_000 : 8_000
  for (const doc of await col
    .find({
      status: { $in: ["queued", "in_progress"] },
      $or: [
        { checkedAt: { $exists: false } },
        { checkedAt: { $lt: new Date(now - staleMs) } },
      ],
    })
    .sort({ checkedAt: 1 })
    .limit(50)
    .toArray()) {
    try {
      await finalizeGeneration(doc._id)
      report.checked += 1
    } catch (error) {
      report.errors += 1
      console.error("[reconcile] finalize failed", {
        id: doc._id.toHexString(),
        error: String(error),
      })
    }
  }

  // 3. Hard cap: still unfinished after 15 minutes → cancel if possible, fail, refund.
  for (const doc of await col
    .find({
      status: { $in: ["queued", "in_progress"] },
      createdAt: { $lt: new Date(now - RUN_DEADLINE_MS) },
    })
    .limit(50)
    .toArray()) {
    if (doc.status === "queued" && doc.hfRequestId)
      await platform()
        .cancel(doc.hfRequestId)
        .catch(() => undefined)
    await settleRefund(doc, "failed", FAILURE_MESSAGES.timedOut)
    report.timedOut += 1
  }
  return report
}
