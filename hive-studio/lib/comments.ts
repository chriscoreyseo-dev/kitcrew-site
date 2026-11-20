import "server-only"

import { ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import type { MediaPerson } from "@/lib/markethive/media"

/** Comments on Media Feed posts (Chris, 2026-10-30, D-079): "the ability for
    people to be able to comment on the images or the videos, just like in the
    newsfeed". Kept here with the post; MarketHive supplies how a commenter is
    shown (name, photo, profile link), applies Black Listing and tells the
    post's owner (lib/markethive/media.ts mediaComment). Plain text only,
    rendered as text - never HTML. */

export type CommentDoc = {
  _id: ObjectId
  generationId: ObjectId
  userId: ObjectId
  /** The commenter's MarketHive member id (markethive mode). */
  memberId?: number
  /** Their name when they commented (the studio's own users have no photo). */
  name: string
  text: string
  createdAt: Date
}

export type CommentDTO = {
  id: string
  text: string
  createdAt: number
  name: string
  /** MarketHive photo and profile link, "" when unknown. */
  pic: string
  url: string
  /** The viewer wrote it. */
  mine: boolean
  /** The viewer may delete it: they wrote it, or it is on their post. */
  canDelete: boolean
}

export type PostComments = { count: number; latest: CommentDTO[] }

export const COMMENT_MAX = 2000
/** Comments shown under a post in the feed before "View all". */
export const COMMENTS_PREVIEW = 2
/** At most this many come back when a post's comments are opened. */
export const COMMENTS_PAGE = 200

export function comments() {
  return db().collection<CommentDoc>("comments")
}

export function cleanComment(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type Viewing = {
  viewerId: string | null
  /** Owner (studio user id, hex) of each post asked about. */
  ownerOf: Map<string, string>
  people: Map<number, MediaPerson> | null
}

/** A comment as the viewer sees it, or null when MarketHive hides its writer
    (a full block between them). */
export function toCommentDTO(doc: CommentDoc, v: Viewing): CommentDTO | null {
  let pic = ""
  let url = ""
  let name = doc.name
  if (v.people && doc.memberId) {
    const p = v.people.get(doc.memberId)
    if (!p) return null
    ;({ pic, url, name } = p)
  }
  const mine = Boolean(v.viewerId && doc.userId.toHexString() === v.viewerId)
  const owner = v.ownerOf.get(doc.generationId.toHexString())
  return {
    id: doc._id.toHexString(),
    text: doc.text,
    createdAt: doc.createdAt.getTime(),
    name,
    pic,
    url,
    mine,
    canDelete: mine || Boolean(v.viewerId && owner === v.viewerId),
  }
}

/** Comment docs for a page of posts: each post's count and its newest few. */
export async function commentsForPosts(
  ids: ObjectId[]
): Promise<Map<string, { count: number; latest: CommentDoc[] }>> {
  const out = new Map<string, { count: number; latest: CommentDoc[] }>()
  for (const id of ids) {
    const [count, latest] = await Promise.all([
      comments().countDocuments({ generationId: id }),
      comments()
        .find({ generationId: id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(COMMENTS_PREVIEW)
        .toArray(),
    ])
    out.set(id.toHexString(), { count, latest: latest.reverse() })
  }
  return out
}

/** All of one post's comments (up to COMMENTS_PAGE), oldest first. */
export async function commentsForPost(id: ObjectId): Promise<CommentDoc[]> {
  const docs = await comments()
    .find({ generationId: id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(COMMENTS_PAGE)
    .toArray()
  return docs.reverse()
}
