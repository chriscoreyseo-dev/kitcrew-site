"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import { RateLimitedError, run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import { memberIdOf } from "@/lib/billing/wallet"
import {
  cleanComment,
  COMMENT_MAX,
  comments,
  commentsForPost,
  toCommentDTO,
} from "@/lib/comments"
import type { CommentDoc, CommentDTO } from "@/lib/comments"
import { authorLabel } from "@/lib/community"
import { loadCommunityFeed } from "@/lib/community-feed"
import type { FeedView } from "@/lib/community-feed"
import {
  GenerationInputError,
  GenerationNotFoundError,
  generations,
} from "@/lib/generations/lifecycle"
import {
  mediaBar,
  mediaComment,
  mediaFeedback,
  mediaLift,
} from "@/lib/markethive/media"
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
const COMMENT_LIMIT = { max: 20, windowSec: 60 } as const
const COMMENT = z.string().max(COMMENT_MAX * 2)
const LIST_LIMIT = { max: 60, windowSec: 60 } as const

async function requireSignedIn() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return user
}

async function limit(
  scope: string,
  id: string,
  l: { max: number; windowSec: number }
) {
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

/** A published post (its owner too), or NOT_FOUND. */
async function publicPost(rawId: unknown) {
  const parsed = ID.safeParse(rawId)
  if (!parsed.success) throw new GenerationNotFoundError()
  const doc = await generations().findOne(
    { _id: new ObjectId(parsed.data), isPublic: true, status: "completed" },
    { projection: { _id: 1, userId: 1 } }
  )
  if (!doc) throw new GenerationNotFoundError()
  return doc
}

/** All of a post's comments, oldest first, as the viewer sees them (a writer
    in a full block with the viewer is left out, as on MarketHive). */
export async function listCommentsAction(
  id: unknown
): Promise<ActionResult<CommentDTO[]>> {
  return run(async () => {
    const post = await publicPost(id)
    const viewer = await currentUser()
    const docs = await commentsForPost(post._id)
    let people = null
    if (viewer && isMarketHive()) {
      const ids = [...new Set(docs.map((d) => d.memberId ?? 0))].filter(
        (n) => n > 0
      )
      const me = await memberIdOf(new ObjectId(viewer.id)).catch(() => 0)
      if (me && ids.length)
        people = await mediaBar(me, [], ids)
          .then((b) => b.people)
          .catch(() => null)
    }
    const ownerOf = new Map([
      [post._id.toHexString(), post.userId.toHexString()],
    ])
    return docs
      .map((d) =>
        toCommentDTO(d, { viewerId: viewer?.id ?? null, ownerOf, people })
      )
      .filter((c): c is CommentDTO => c !== null)
  })
}

/** Comment on a post. Plain text; MarketHive applies Black Listing and tells
    the post's owner. */
export async function addCommentAction(
  id: unknown,
  text: unknown
): Promise<ActionResult<CommentDTO>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsed = COMMENT.safeParse(text)
    if (!parsed.success)
      throw new GenerationInputError(`Keep it under ${COMMENT_MAX} characters.`)
    const body = cleanComment(parsed.data)
    if (!body) throw new GenerationInputError("Write something first.")
    if (body.length > COMMENT_MAX)
      throw new GenerationInputError(`Keep it under ${COMMENT_MAX} characters.`)
    await limit("comments", user.id, COMMENT_LIMIT)
    const post = await publicPost(id)

    let name = authorLabel({ email: user.email })
    let pic = ""
    let url = ""
    let memberId: number | undefined
    if (isMarketHive()) {
      const [viewer, author] = await Promise.all([
        memberIdOf(new ObjectId(user.id)),
        memberIdOf(post.userId),
      ]).catch(() => {
        throw new GenerationInputError("Comments work for MarketHive members.")
      })
      const person = await mediaComment({
        viewerMemberId: viewer,
        authorMemberId: author,
        mediaId: post._id.toHexString(),
      })
      memberId = viewer
      if (person) ({ name, pic, url } = person)
    }
    const doc: CommentDoc = {
      _id: new ObjectId(),
      generationId: post._id,
      userId: new ObjectId(user.id),
      ...(memberId ? { memberId } : {}),
      name,
      text: body,
      createdAt: new Date(),
    }
    await comments().insertOne(doc)
    return {
      id: doc._id.toHexString(),
      text: body,
      createdAt: doc.createdAt.getTime(),
      name,
      pic,
      url,
      mine: true,
      canDelete: true,
    }
  })
}

/** Deletes a comment: its writer, or the owner of the post it is on. */
export async function deleteCommentAction(
  commentId: unknown
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await requireSignedIn()
    const parsed = ID.safeParse(commentId)
    if (!parsed.success) throw new GenerationNotFoundError()
    await limit("comments", user.id, COMMENT_LIMIT)
    const doc = await comments().findOne({ _id: new ObjectId(parsed.data) })
    if (!doc) throw new GenerationNotFoundError()
    const mine = doc.userId.toHexString() === user.id
    if (!mine) {
      const post = await generations().findOne(
        { _id: doc.generationId },
        { projection: { userId: 1 } }
      )
      if (!post || post.userId.toHexString() !== user.id)
        throw new GenerationNotFoundError()
    }
    await comments().deleteOne({ _id: doc._id })
    return { id: parsed.data }
  })
}
