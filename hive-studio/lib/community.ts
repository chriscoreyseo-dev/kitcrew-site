import "server-only"

import { ObjectId } from "mongodb"
import type { Filter } from "mongodb"

import type { Surface } from "@/generation/catalog/types"
import { db } from "@/lib/db/mongo"
import { generations } from "@/lib/generations/lifecycle"
import type { GenerationDoc } from "@/lib/generations/model"
import type { OutputKind } from "@/lib/higgsfield/types"

/** Public community data. Only completed, published generations are visible;
    everything else (unpublished, failed, someone's private run) looks exactly
    like a missing id. The DTO is an allowlist: userId, email, hfRequestId,
    r2Key, modelPath, cost and input media never leave the server. The author
    is the member's MarketHive display name (D-065), else a masked email. */

export type PublicGenerationDTO = {
  id: string
  surface: Surface
  /** Kind of the first output; drives <img> vs <video>. */
  kind: OutputKind
  urls: string[]
  prompt: string
  modelId: string
  modelLabel: string
  settings: Record<string, unknown>
  aspect: number
  publishedAt: number
  /** MarketHive display name, else a masked email ("chr…"). */
  author: string
}

export type CommunityPage = {
  items: PublicGenerationDTO[]
  /** Opaque cursor for the next page, or null at the end. */
  nextCursor: string | null
}

export const COMMUNITY_PAGE_SIZE = 24

const PUBLIC: Filter<GenerationDoc> = { isPublic: true, status: "completed" }

/** "christopher@example.com" -> "chr…". Never more than three characters. */
export function maskAuthor(email: string | undefined | null): string {
  const local = (email ?? "").split("@")[0]?.trim() ?? ""
  if (!local) return "creator"
  return `${local.slice(0, Math.min(3, local.length))}…`
}

/** Settings are model options (aspect, duration…). Keep only plain scalars so
    nothing nested or unexpected is ever echoed to the public. */
function publicSettings(
  settings: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings ?? {})) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      out[key] = value
  }
  return out
}

type Author = { email?: string; name?: string }

/** The MarketHive NAME the member already shows on MarketHive (the same name
    /watch/studio prints as "Shared by"); members without one get maskAuthor. */
export function authorLabel(author: Author | undefined | null): string {
  const name = author?.name?.trim().slice(0, 60)
  return name || maskAuthor(author?.email)
}

export function toPublicDTO(
  doc: GenerationDoc,
  author?: Author | null
): PublicGenerationDTO {
  const outputs = doc.outputs ?? []
  return {
    id: doc._id.toHexString(),
    surface: doc.surface,
    kind: outputs[0]?.kind ?? (doc.surface === "video" ? "video" : "image"),
    urls: outputs.map((o) => o.url),
    prompt: doc.prompt,
    modelId: doc.modelId,
    modelLabel: doc.modelLabel,
    settings: publicSettings(doc.settings),
    aspect: doc.aspect || 1,
    publishedAt: (doc.publishedAt ?? doc.updatedAt).getTime(),
    author: authorLabel(author),
  }
}

type UserAuthorDoc = {
  _id: ObjectId
  email?: string
  markethive?: { name?: string }
}

async function authorsFor(userIds: ObjectId[]): Promise<Map<string, Author>> {
  if (!userIds.length) return new Map()
  const users = await db()
    .collection<UserAuthorDoc>("users")
    .find(
      { _id: { $in: userIds } },
      { projection: { _id: 1, email: 1, "markethive.name": 1 } }
    )
    .toArray()
  return new Map(
    users.map((u) => [
      u._id.toHexString(),
      { email: u.email, name: u.markethive?.name },
    ])
  )
}

export function encodeCursor(doc: Pick<GenerationDoc, "_id" | "publishedAt">) {
  return `${doc.publishedAt?.getTime() ?? 0}_${doc._id.toHexString()}`
}

export function decodeCursor(
  cursor: string | null | undefined
): { at: Date; id: ObjectId } | null {
  if (!cursor) return null
  const match = /^(\d{1,15})_([0-9a-f]{24})$/.exec(cursor)
  if (!match) return null
  return { at: new Date(Number(match[1])), id: new ObjectId(match[2]) }
}

/** Newest first, keyset-paginated on (publishedAt, _id) so ties never skip. */
export async function listPublicGenerations(
  cursor?: string | null,
  limit = COMMUNITY_PAGE_SIZE
): Promise<CommunityPage> {
  const after = decodeCursor(cursor)
  const filter: Filter<GenerationDoc> = after
    ? {
        ...PUBLIC,
        $or: [
          { publishedAt: { $lt: after.at } },
          { publishedAt: after.at, _id: { $lt: after.id } },
        ],
      }
    : PUBLIC
  const size = Math.min(Math.max(1, Math.floor(limit)), 60)
  const docs = await generations()
    .find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(size + 1)
    .toArray()
  const page = docs.slice(0, size).filter((d) => d.outputs?.length)
  const authors = await authorsFor([
    ...new Map(page.map((d) => [d.userId.toHexString(), d.userId])).values(),
  ])
  const last = docs[size - 1]
  return {
    items: page.map((d) => toPublicDTO(d, authors.get(d.userId.toHexString()))),
    nextCursor: docs.length > size && last ? encodeCursor(last) : null,
  }
}

/** One published generation, or null (unpublished and missing look the same). */
export async function getPublicGeneration(
  id: string
): Promise<PublicGenerationDTO | null> {
  if (!/^[0-9a-f]{24}$/.test(id)) return null
  const doc = await generations().findOne({ ...PUBLIC, _id: new ObjectId(id) })
  if (!doc || !doc.outputs?.length) return null
  const authors = await authorsFor([doc.userId])
  return toPublicDTO(doc, authors.get(doc.userId.toHexString()))
}

/** Whether `userId` owns the published generation `id` (for the owner-only
    Unpublish control on the detail page). */
export async function isPublicOwner(
  id: string,
  userId: string
): Promise<boolean> {
  if (!/^[0-9a-f]{24}$/.test(id) || !ObjectId.isValid(userId)) return false
  const doc = await generations().findOne({
    ...PUBLIC,
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  })
  return Boolean(doc)
}
