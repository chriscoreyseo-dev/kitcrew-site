import "server-only"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"
import { generations } from "@/lib/generations/lifecycle"
import type { OutputKind } from "@/lib/higgsfield/types"

/** Sharing a generation (S581, Chris): a member's Share button marks that one
    run shared, which makes its files public (D-063 media access) and gives it a
    page on MarketHive, /watch/studio/<slug>, where the JOIN button credits the
    member as the referrer - the same model as the home page's Newest Video.
    Nothing is shared until the member clicks Share; everything else stays private.

    A slug is the run id, plus "-<n>" for output n > 0 of a multi-image run. */
const SLUG = /^([a-f0-9]{24})(?:-([1-9]\d?))?$/

export function shareSlug(runId: string, index = 0): string {
  return index > 0 ? `${runId}-${index}` : runId
}

export function parseShareSlug(
  slug: string
): { runId: string; index: number } | null {
  const m = SLUG.exec(slug)
  return m ? { runId: m[1], index: m[2] ? Number(m[2]) : 0 } : null
}

/** The member-facing link, or null when this studio isn't inside MarketHive. */
export function shareUrl(slug: string): string | null {
  const home = env().MARKETHIVE_BASE_URL
  return home ? `${home.replace(/\/$/, "")}/watch/studio/${slug}` : null
}

/** Marks the caller's own completed run shared (idempotent). False when the run
    isn't theirs, isn't finished, or doesn't have that output. */
export async function markShared(
  userId: string,
  runId: string,
  index: number,
  now = new Date()
): Promise<boolean> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(runId)) return false
  const filter = {
    _id: new ObjectId(runId),
    userId: new ObjectId(userId),
    status: "completed" as const,
    [`outputs.${index}`]: { $exists: true },
  }
  const doc = await generations().findOne(filter, {
    projection: { sharedAt: 1 },
  })
  if (!doc) return false
  if (!doc.sharedAt)
    await generations().updateOne(
      { ...filter, sharedAt: { $exists: false } },
      { $set: { sharedAt: now } }
    )
  return true
}

export type SharedView = {
  slug: string
  kind: OutputKind
  src: string
  aspect: number
  memberId: number | null
  createdAt: number
}

/** What MarketHive's share page needs, for a shared run only. Unshared,
    unfinished and missing runs all look the same (null). The prompt is not
    included: sharing the picture is not sharing how it was made. */
export async function sharedView(slug: string): Promise<SharedView | null> {
  const parsed = parseShareSlug(slug)
  if (!parsed) return null
  const doc = await generations().findOne(
    {
      _id: new ObjectId(parsed.runId),
      status: "completed",
      sharedAt: { $exists: true },
    },
    { projection: { userId: 1, outputs: 1, aspect: 1, createdAt: 1 } }
  )
  const output = doc?.outputs[parsed.index]
  if (!doc || !output) return null
  const owner = await db()
    .collection<{ _id: ObjectId; markethive?: { memberId?: number } }>("users")
    .findOne({ _id: doc.userId }, { projection: { markethive: 1 } })
  return {
    slug,
    kind: output.kind,
    src: output.url,
    aspect: doc.aspect,
    memberId: owner?.markethive?.memberId ?? null,
    createdAt: doc.createdAt.getTime(),
  }
}
