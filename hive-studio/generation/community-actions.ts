"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import { RateLimitedError, run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import { CAPTION_MAX, listPublicGenerations } from "@/lib/community"
import type { CommunityPage } from "@/lib/community"
import {
  findOwned,
  GenerationInputError,
  GenerationNotFoundError,
  generations,
} from "@/lib/generations/lifecycle"
import { reports } from "@/lib/presets"
import type { ReportDoc } from "@/lib/presets"
import { hit } from "@/lib/rate-limit"
import { currentUser } from "@/lib/session"

const ID = z.string().regex(/^[0-9a-f]{24}$/)
const PUBLISH = z.boolean()
export type ReportReason = ReportDoc["reason"]
const REASON = z.enum(["nsfw", "copyright", "hateful", "spam", "other"])
const NOTE = z.string().trim().max(500).optional()
const CURSOR = z
  .string()
  .regex(/^\d{1,15}_[0-9a-f]{24}$/)
  .nullish()

const CAPTION = z.string().max(CAPTION_MAX * 2)
/** Caption saves per user per minute. */
const CAPTION_LIMIT = { max: 30, windowSec: 60 } as const

/** Reports per user per hour. ("use server" files export only async functions.) */
const REPORT_LIMIT = { max: 10, windowSec: 60 * 60 } as const

async function requireSignedIn() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return user
}

/** Owner-only. Only completed generations can be published; someone else's
    id is NOT_FOUND. Unpublishing clears `publishedAt`. */
export async function publishGenerationAction(
  id: unknown,
  publish: unknown
): Promise<
  ActionResult<{ id: string; isPublic: boolean; publishedAt: number | null }>
> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedId = ID.safeParse(id)
    const parsedPublish = PUBLISH.safeParse(publish)
    if (!parsedId.success) throw new GenerationNotFoundError()
    if (!parsedPublish.success)
      throw new GenerationInputError("Invalid request.")
    const doc = await findOwned(user.id, parsedId.data)
    if (parsedPublish.data) {
      if (doc.status !== "completed" || !doc.outputs.length)
        throw new GenerationInputError(
          "Only finished generations can be published."
        )
      // Keep the original date when publishing twice, so the feed order holds.
      const publishedAt =
        doc.isPublic && doc.publishedAt ? doc.publishedAt : new Date()
      await generations().updateOne(
        { _id: doc._id, userId: doc.userId, status: "completed" },
        { $set: { isPublic: true, publishedAt, updatedAt: new Date() } }
      )
      return {
        id: parsedId.data,
        isPublic: true,
        publishedAt: publishedAt.getTime(),
      }
    }
    await generations().updateOne(
      { _id: doc._id, userId: doc.userId },
      {
        $set: { isPublic: false, updatedAt: new Date() },
        $unset: { publishedAt: "" },
      }
    )
    return { id: parsedId.data, isPublic: false, publishedAt: null }
  })
}

/** Owner-only (S584, D-070): the creator's write-up shown beside the creation in
    Hive Community. Plain text: control characters are dropped, runs of blank
    lines collapsed, trimmed, at most CAPTION_MAX characters; empty clears it.
    Someone else's run is NOT_FOUND. */
export async function updateCaptionAction(
  id: unknown,
  caption: unknown
): Promise<ActionResult<{ id: string; caption: string }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedId = ID.safeParse(id)
    const parsed = CAPTION.safeParse(caption)
    if (!parsedId.success) throw new GenerationNotFoundError()
    if (!parsed.success)
      throw new GenerationInputError(`Keep it under ${CAPTION_MAX} characters.`)
    const text = parsed.data
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    if (text.length > CAPTION_MAX)
      throw new GenerationInputError(`Keep it under ${CAPTION_MAX} characters.`)
    const limit = await hit({
      scope: "caption",
      id: user.id,
      max: CAPTION_LIMIT.max,
      windowSec: CAPTION_LIMIT.windowSec,
    })
    if (!limit.ok)
      throw new RateLimitedError("Saving too fast. Try again in a moment.")
    const doc = await findOwned(user.id, parsedId.data)
    if (doc.status !== "completed")
      throw new GenerationInputError(
        "Only finished creations can have a write-up."
      )
    await generations().updateOne(
      { _id: doc._id, userId: doc.userId },
      text
        ? {
            $set: {
              caption: text,
              captionUpdatedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        : {
            $unset: { caption: "", captionUpdatedAt: "" },
            $set: { updatedAt: new Date() },
          }
    )
    return { id: parsedId.data, caption: text }
  })
}

/** Signed-in users, public generations only. One open report per
    (reporter, generation): a repeat is ok and writes nothing. */
export async function reportGenerationAction(
  id: unknown,
  reason: unknown,
  note?: unknown
): Promise<ActionResult<{ alreadyReported: boolean }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedId = ID.safeParse(id)
    if (!parsedId.success) throw new GenerationNotFoundError()
    const parsedReason = REASON.safeParse(reason)
    const parsedNote = NOTE.safeParse(
      note === null || note === "" ? undefined : note
    )
    if (!parsedReason.success || !parsedNote.success)
      throw new GenerationInputError(
        "Choose a reason (note up to 500 characters)."
      )

    const limit = await hit({
      scope: "report",
      id: user.id,
      max: REPORT_LIMIT.max,
      windowSec: REPORT_LIMIT.windowSec,
    })
    if (!limit.ok)
      throw new RateLimitedError(
        "You've sent a lot of reports. Try again later."
      )

    const generationId = new ObjectId(parsedId.data)
    const target = await generations().findOne({
      _id: generationId,
      isPublic: true,
      status: "completed",
    })
    if (!target) throw new GenerationNotFoundError()

    const reporterId = new ObjectId(user.id)
    const existing = await reports().findOne({
      generationId,
      reporterId,
      status: "open",
    })
    if (existing) return { alreadyReported: true }

    const doc: ReportDoc = {
      _id: new ObjectId(),
      generationId,
      reporterId,
      reason: parsedReason.data,
      ...(parsedNote.data ? { note: parsedNote.data } : {}),
      status: "open",
      createdAt: new Date(),
    }
    try {
      await reports().insertOne(doc)
    } catch (error) {
      // A unique index on open reports turns a double submit into a no-op.
      if ((error as { code?: unknown }).code === 11000)
        return { alreadyReported: true }
      throw error
    }
    return { alreadyReported: false }
  })
}

/** Public: the next page of the community feed (load more). */
export async function listCommunityAction(
  cursor: unknown
): Promise<ActionResult<CommunityPage>> {
  return run(async () => {
    const parsed = CURSOR.safeParse(cursor)
    if (!parsed.success) throw new GenerationInputError("Invalid cursor.")
    const viewer = await currentUser()
    return listPublicGenerations(
      parsed.data ?? null,
      undefined,
      viewer?.id ?? null
    )
  })
}
