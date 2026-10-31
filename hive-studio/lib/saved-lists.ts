import "server-only"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import { GenerationInputError, generations } from "@/lib/generations/lifecycle"

/** Watch Later and playlists (Chris, 2026-10-30, D-079): the Media Feed's
    three-dot menu, like YouTube's - Save to Watch Later, Save to playlist,
    Share; no Download, no queue. A list holds published generations only, per
    user; Watch Later is the one list of kind "watch_later" (created on first
    save), playlists are named. Items keep the order they were added in; the
    pages show the newest first and skip anything since unpublished. */

export type SavedListKind = "watch_later" | "playlist"

export type SavedListDoc = {
  _id: ObjectId
  userId: ObjectId
  kind: SavedListKind
  name: string
  items: { generationId: ObjectId; addedAt: Date }[]
  createdAt: Date
  updatedAt: Date
}

export type PlaylistSummary = {
  id: string
  name: string
  count: number
  /** The generation asked about is in this playlist. */
  has: boolean
}

export const PLAYLIST_NAME_MAX = 80
export const PLAYLISTS_MAX = 50
export const LIST_ITEMS_MAX = 500
export const WATCH_LATER_NAME = "Watch Later"

export function savedLists() {
  return db().collection<SavedListDoc>("saved_lists")
}

/** Only a published, finished generation can be saved. */
async function requirePublic(generationId: ObjectId) {
  const doc = await generations().findOne(
    { _id: generationId, isPublic: true, status: "completed" },
    { projection: { _id: 1 } }
  )
  if (!doc) throw new GenerationInputError("That post is no longer published.")
}

export function cleanPlaylistName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PLAYLIST_NAME_MAX)
}

/** Ids (hex) of `generationIds` that are in the user's Watch Later. */
export async function watchLaterIds(
  userId: string,
  generationIds: string[]
): Promise<string[]> {
  if (!generationIds.length) return []
  const list = await savedLists().findOne(
    { userId: new ObjectId(userId), kind: "watch_later" },
    { projection: { items: 1 } }
  )
  const wanted = new Set(generationIds)
  return (list?.items ?? [])
    .map((i) => i.generationId.toHexString())
    .filter((id) => wanted.has(id))
}

/** Adds or removes one generation from Watch Later. */
export async function setWatchLater(
  userId: string,
  generationId: string,
  saved: boolean
): Promise<boolean> {
  const user = new ObjectId(userId)
  const gen = new ObjectId(generationId)
  const now = new Date()
  if (!saved) {
    await savedLists().updateOne(
      { userId: user, kind: "watch_later" },
      { $pull: { items: { generationId: gen } }, $set: { updatedAt: now } }
    )
    return false
  }
  await requirePublic(gen)
  // One Watch Later per user: created on the first save (unique index).
  await savedLists().updateOne(
    { userId: user, kind: "watch_later" },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        name: WATCH_LATER_NAME,
        items: [],
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true }
  )
  const added = await savedLists().updateOne(
    {
      userId: user,
      kind: "watch_later",
      "items.generationId": { $ne: gen },
      [`items.${LIST_ITEMS_MAX - 1}`]: { $exists: false },
    },
    { $push: { items: { generationId: gen, addedAt: now } } }
  )
  if (!added.modifiedCount) {
    const has = await savedLists().countDocuments({
      userId: user,
      kind: "watch_later",
      "items.generationId": gen,
    })
    if (!has)
      throw new GenerationInputError(
        `Watch Later holds ${LIST_ITEMS_MAX} posts. Remove some first.`
      )
  }
  return true
}

/** The user's playlists, newest first, each saying whether it holds `generationId`. */
export async function listPlaylists(
  userId: string,
  generationId?: string | null
): Promise<PlaylistSummary[]> {
  const gen = generationId ? generationId : null
  const lists = await savedLists()
    .find({ userId: new ObjectId(userId), kind: "playlist" })
    .sort({ createdAt: -1 })
    .limit(PLAYLISTS_MAX)
    .toArray()
  return lists.map((l) => ({
    id: l._id.toHexString(),
    name: l.name,
    count: l.items.length,
    has: gen
      ? l.items.some((i) => i.generationId.toHexString() === gen)
      : false,
  }))
}

export async function createPlaylist(
  userId: string,
  rawName: string,
  generationId?: string | null
): Promise<PlaylistSummary> {
  const name = cleanPlaylistName(rawName)
  if (!name) throw new GenerationInputError("Give the playlist a name.")
  const user = new ObjectId(userId)
  const total = await savedLists().countDocuments({
    userId: user,
    kind: "playlist",
  })
  if (total >= PLAYLISTS_MAX)
    throw new GenerationInputError(
      `You can have ${PLAYLISTS_MAX} playlists. Delete one first.`
    )
  const items: SavedListDoc["items"] = []
  if (generationId) {
    const gen = new ObjectId(generationId)
    await requirePublic(gen)
    items.push({ generationId: gen, addedAt: new Date() })
  }
  const now = new Date()
  const doc: SavedListDoc = {
    _id: new ObjectId(),
    userId: user,
    kind: "playlist",
    name,
    items,
    createdAt: now,
    updatedAt: now,
  }
  await savedLists().insertOne(doc)
  return { id: doc._id.toHexString(), name, count: items.length, has: true }
}

/** Puts one generation in or out of one of the user's playlists. */
export async function setPlaylistItem(
  userId: string,
  playlistId: string,
  generationId: string,
  inList: boolean
): Promise<void> {
  const filter = {
    _id: new ObjectId(playlistId),
    userId: new ObjectId(userId),
    kind: "playlist" as const,
  }
  const gen = new ObjectId(generationId)
  const now = new Date()
  if (!inList) {
    const res = await savedLists().updateOne(filter, {
      $pull: { items: { generationId: gen } },
      $set: { updatedAt: now },
    })
    if (!res.matchedCount)
      throw new GenerationInputError("That playlist is gone.")
    return
  }
  await requirePublic(gen)
  const res = await savedLists().updateOne(
    {
      ...filter,
      "items.generationId": { $ne: gen },
      [`items.${LIST_ITEMS_MAX - 1}`]: { $exists: false },
    },
    {
      $push: { items: { generationId: gen, addedAt: now } },
      $set: { updatedAt: now },
    }
  )
  if (res.matchedCount) return
  const list = await savedLists().findOne(filter, { projection: { items: 1 } })
  if (!list) throw new GenerationInputError("That playlist is gone.")
  if (!list.items.some((i) => i.generationId.equals(gen)))
    throw new GenerationInputError(
      `A playlist holds ${LIST_ITEMS_MAX} posts. Remove some first.`
    )
}

export async function deletePlaylist(
  userId: string,
  playlistId: string
): Promise<void> {
  await savedLists().deleteOne({
    _id: new ObjectId(playlistId),
    userId: new ObjectId(userId),
    kind: "playlist",
  })
}

/** One list's generation ids, newest saved first. null when it isn't the user's. */
export async function listItemIds(
  userId: string,
  which: { kind: "watch_later" } | { kind: "playlist"; id: string }
): Promise<{ name: string; ids: ObjectId[] } | null> {
  const list = await savedLists().findOne(
    which.kind === "watch_later"
      ? { userId: new ObjectId(userId), kind: "watch_later" }
      : {
          _id: new ObjectId(which.id),
          userId: new ObjectId(userId),
          kind: "playlist",
        }
  )
  if (!list)
    return which.kind === "watch_later"
      ? { name: WATCH_LATER_NAME, ids: [] }
      : null
  const ids = [...list.items]
    .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
    .map((i) => i.generationId)
  return { name: list.name, ids }
}
