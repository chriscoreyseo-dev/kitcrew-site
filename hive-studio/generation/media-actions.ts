"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import { RateLimitedError, run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import { memberIdOf } from "@/lib/billing/wallet"
import { loadCommunityFeed } from "@/lib/community-feed"
import type { FeedView } from "@/lib/community-feed"
import {
  GenerationInputError,
  GenerationNotFoundError,
  generations,
} from "@/lib/generations/lifecycle"
import { mediaFeedback, mediaLift } from "@/lib/markethive/media"
import type { LiftOutcome, MediaFeedback } from "@/lib/markethive/media"
import { isMarketHive } from "@/lib/mode"
import { hit } from "@/lib/rate-limit"
import {
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  setPlaylistItem,
  setWatchLater,
} from "@/lib/saved-lists"
import type { PlaylistSummary } from "@/lib/saved-lists"
import { currentUser } from "@/lib/session"

/** The Media Feed's action bar and three-dot menu (D-079). The bar's actions
    reach MarketHive (lib/markethive/media.ts) as the signed-in member, about
    the member who made the post; the studio looks both up itself, the browser
    only names the post. The menu's lists live here (lib/saved-lists.ts). */

const ID = z.string().regex(/^[0-9a-f]{24}$/)
const FEEDBACK = z.enum(["like", "dislike", "star", "exclude"])
const LIFT = z.object({
  buy: z.boolean(),
  expectedPrice: z
    .string()
    .regex(/^\d{1,6}\.\d{2}$/)
    .nullable(),
})
const NAME = z.string().max(400)
const CURSOR = z
  .string()
  .regex(/^\d{1,15}_[0-9a-f]{24}$/)
  .nullish()

/** Per user per minute: bar clicks, and list edits. */
const BAR_LIMIT = { max: 60, windowSec: 60 } as const
const LIST_LIMIT = { max: 60, windowSec: 60 } as const

async function requireSignedIn() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return user
}

async function limit(scope: string, id: string, l: typeof BAR_LIMIT) {
  const result = await hit({ scope, id, max: l.max, windowSec: l.windowSec })
  if (!result.ok)
    throw new RateLimitedError("That's a lot of clicks. Try again in a moment.")
}

/** The viewer and the author of a published post, as MarketHive members. */
async function membersFor(userId: string, rawId: unknown) {
  if (!isMarketHive())
    throw new GenerationInputError("This works inside MarketHive.")
  const parsed = ID.safeParse(rawId)
  if (!parsed.success) throw new GenerationNotFoundError()
  const doc = await generations().findOne(
    { _id: new ObjectId(parsed.data), isPublic: true, status: "completed" },
    { projection: { _id: 1, userId: 1 } }
  )
  if (!doc) throw new GenerationNotFoundError()
  if (doc.userId.toHexString() === userId)
    throw new GenerationInputError("That's your own post.")
  const [viewer, author] = await Promise.all([
    memberIdOf(new ObjectId(userId)),
    memberIdOf(doc.userId),
  ]).catch(() => {
    throw new GenerationInputError("This post's creator isn't on MarketHive.")
  })
  return { mediaId: parsed.data, viewer, author, doc }
}

/** Like / Dislike / Gold Star / Red Alert (exclude the member). */
export async function mediaFeedbackAction(
  id: unknown,
  signal: unknown
): Promise<ActionResult<{ signal: MediaFeedback; already: boolean }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsed = FEEDBACK.safeParse(signal)
    if (!parsed.success) throw new GenerationInputError("Invalid request.")
    await limit("media-bar", user.id, BAR_LIMIT)
    const m = await membersFor(user.id, id)
    const result = await mediaFeedback({
      viewerMemberId: m.viewer,
      authorMemberId: m.author,
      mediaId: m.mediaId,
      signal: parsed.data,
    })
    return { signal: parsed.data, already: result.already }
  })
}

/** THE LIFT. A lifted post rises to the top of the Media Feed for everyone. */
export async function mediaLiftAction(
  id: unknown,
  options: unknown
): Promise<ActionResult<LiftOutcome>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsed = LIFT.safeParse(options)
    if (!parsed.success) throw new GenerationInputError("Invalid request.")
    await limit("media-bar", user.id, BAR_LIMIT)
    const m = await membersFor(user.id, id)
    const outcome = await mediaLift({
      viewerMemberId: m.viewer,
      authorMemberId: m.author,
      mediaId: m.mediaId,
      buy: parsed.data.buy,
      expectedPrice: parsed.data.expectedPrice,
    })
    // MarketHive holds who paid; the feed order lives here. "already" also sets
    // it, so a post lifted while the studio missed the answer still rises.
    if (outcome.status === "lifted" || outcome.status === "already")
      await generations().updateOne(
        { _id: m.doc._id, liftedAt: { $exists: false } },
        { $set: { liftedAt: new Date() } }
      )
    return outcome
  })
}

/** Save to (or take out of) Watch Later. */
export async function watchLaterAction(
  id: unknown,
  saved: unknown
): Promise<ActionResult<{ saved: boolean }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedId = ID.safeParse(id)
    if (!parsedId.success || typeof saved !== "boolean")
      throw new GenerationNotFoundError()
    await limit("saved-lists", user.id, LIST_LIMIT)
    return { saved: await setWatchLater(user.id, parsedId.data, saved) }
  })
}

/** The viewer's playlists, each saying whether it holds post `id`. */
export async function playlistsForAction(
  id: unknown
): Promise<ActionResult<PlaylistSummary[]>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedId = ID.nullable().safeParse(id ?? null)
    if (!parsedId.success) throw new GenerationNotFoundError()
    return listPlaylists(user.id, parsedId.data)
  })
}

/** A new playlist, holding post `id` when one is given. */
export async function createPlaylistAction(
  name: unknown,
  id: unknown
): Promise<ActionResult<PlaylistSummary>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsedName = NAME.safeParse(name)
    const parsedId = ID.nullable().safeParse(id ?? null)
    if (!parsedName.success || !parsedId.success)
      throw new GenerationInputError("Invalid request.")
    await limit("saved-lists", user.id, LIST_LIMIT)
    return createPlaylist(user.id, parsedName.data, parsedId.data)
  })
}

/** Ticks post `id` in or out of playlist `playlistId`. */
export async function playlistItemAction(
  playlistId: unknown,
  id: unknown,
  inList: unknown
): Promise<ActionResult<{ inList: boolean }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const list = ID.safeParse(playlistId)
    const gen = ID.safeParse(id)
    if (!list.success || !gen.success || typeof inList !== "boolean")
      throw new GenerationNotFoundError()
    await limit("saved-lists", user.id, LIST_LIMIT)
    await setPlaylistItem(user.id, list.data, gen.data, inList)
    return { inList }
  })
}

export async function deletePlaylistAction(
  playlistId: unknown
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const list = ID.safeParse(playlistId)
    if (!list.success) throw new GenerationNotFoundError()
    await limit("saved-lists", user.id, LIST_LIMIT)
    await deletePlaylist(user.id, list.data)
    return { id: list.data }
  })
}

/** The next page of the Media Feed, with its action bar (load more). */
export async function mediaFeedPageAction(
  cursor: unknown
): Promise<ActionResult<FeedView>> {
  return run(async () => {
    const parsed = CURSOR.safeParse(cursor)
    if (!parsed.success) throw new GenerationInputError("Invalid cursor.")
    const viewer = await currentUser()
    return loadCommunityFeed(parsed.data ?? null, viewer)
  })
}
