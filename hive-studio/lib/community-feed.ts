import "server-only"

import { createHash } from "node:crypto"
import { ObjectId } from "mongodb"

import { authorsFor, publicPageDocs, toPublicDTO } from "@/lib/community"
import type { PublicGenerationDTO } from "@/lib/community"
import { generations } from "@/lib/generations/lifecycle"
import type { GenerationDoc } from "@/lib/generations/model"
import { memberIdOf } from "@/lib/billing/wallet"
import { mediaBar } from "@/lib/markethive/media"
import type {
  MediaAssets,
  MediaBadge,
  MediaSignal,
} from "@/lib/markethive/media"
import { isMarketHive } from "@/lib/mode"
import { watchLaterIds } from "@/lib/saved-lists"

/** The Media Feed as the viewer sees it (D-079): the posts, plus the News
    Feed's action bar for each one and which are in their Watch Later.
    Member ids never reach the browser: a post's author is an opaque
    `authorKey`, enough for the page to hide every post of a member the viewer
    has just excluded. */

export type PostBar = {
  badges: MediaBadge[]
  signals: MediaSignal[]
  lifted: boolean
  authorKey: string
}

export type FeedBar = {
  ready: boolean
  assets: MediaAssets
  lifts: number
  price: string
  balance: string
  posts: Record<string, PostBar>
}

export type FeedView = {
  items: PublicGenerationDTO[]
  nextCursor: string | null
  /** null: no bar (standalone studio, signed out, or MarketHive unreachable). */
  bar: FeedBar | null
  watchLater: string[]
}

type Viewer = { id: string } | null

/** media_feed_lib.php's MH_MF_MAX_ITEMS. */
const BAR_CHUNK = 60

function authorKey(userId: ObjectId): string {
  return createHash("sha256")
    .update(`hive-studio-author.v1.${userId.toHexString()}`)
    .digest("hex")
    .slice(0, 16)
}

async function viewerMemberId(viewer: Viewer): Promise<number | null> {
  if (!viewer || !isMarketHive() || !ObjectId.isValid(viewer.id)) return null
  return memberIdOf(new ObjectId(viewer.id)).catch(() => null)
}

/** The page's docs as the viewer sees them: the bar from MarketHive, and with
    any member they excluded (the News Feed's Red Alert list) left out. */
async function view(
  docs: GenerationDoc[],
  authors: Awaited<ReturnType<typeof authorsFor>>,
  nextCursor: string | null,
  viewer: Viewer
): Promise<FeedView> {
  let bar: FeedBar | null = null
  let shown = docs
  const memberId = await viewerMemberId(viewer)
  if (memberId && docs.length) {
    const memberOf = (d: GenerationDoc) =>
      authors.get(d.userId.toHexString())?.memberId ?? 0
    try {
      const asks = docs
        .filter((d) => memberOf(d) > 0)
        .map((d) => ({
          mediaId: d._id.toHexString(),
          authorMemberId: memberOf(d),
        }))
      // MarketHive answers for BAR_CHUNK posts at a time (a saved list can be longer).
      const data = await mediaBar(memberId, asks.slice(0, BAR_CHUNK))
      for (let i = BAR_CHUNK; i < asks.length; i += BAR_CHUNK) {
        const more = await mediaBar(memberId, asks.slice(i, i + BAR_CHUNK))
        more.badges.forEach((v, k) => data.badges.set(k, v))
        more.signals.forEach((v, k) => data.signals.set(k, v))
        more.lifted.forEach((id) => data.lifted.add(id))
      }
      shown = docs.filter((d) => !data.excluded.has(memberOf(d)))
      const posts: Record<string, PostBar> = {}
      for (const d of shown) {
        const id = d._id.toHexString()
        posts[id] = {
          badges: data.badges.get(memberOf(d)) ?? [],
          signals: data.signals.get(id) ?? [],
          lifted: data.lifted.has(id) || Boolean(d.liftedAt),
          authorKey: authorKey(d.userId),
        }
      }
      bar = {
        ready: data.ready,
        assets: data.assets,
        lifts: data.lifts,
        price: data.price,
        balance: data.balance,
        posts,
      }
    } catch (error) {
      // The feed still shows; only the bar waits for MarketHive.
      console.error("[community] action bar unavailable", error)
    }
  }
  const items = shown.map((d) =>
    toPublicDTO(d, authors.get(d.userId.toHexString()), viewer?.id ?? null)
  )
  const watchLater = viewer
    ? await watchLaterIds(
        viewer.id,
        items.map((i) => i.id)
      ).catch(() => [])
    : []
  return { items, nextCursor, bar, watchLater }
}

/** One page of the Media Feed (newest first; lifted posts rise). */
export async function loadCommunityFeed(
  cursor: string | null,
  viewer: Viewer
): Promise<FeedView> {
  const page = await publicPageDocs(cursor)
  return view(page.docs, page.authors, page.nextCursor, viewer)
}

/** A saved list's posts, in the order given, skipping any since unpublished. */
export async function loadSavedFeed(
  ids: ObjectId[],
  viewer: Viewer
): Promise<FeedView> {
  if (!ids.length)
    return { items: [], nextCursor: null, bar: null, watchLater: [] }
  const found = await generations()
    .find({ _id: { $in: ids }, isPublic: true, status: "completed" })
    .toArray()
  const byId = new Map(found.map((d) => [d._id.toHexString(), d]))
  const docs = ids
    .map((id) => byId.get(id.toHexString()))
    .filter((d): d is GenerationDoc => Boolean(d?.outputs?.length))
  const authors = await authorsFor([
    ...new Map(docs.map((d) => [d.userId.toHexString(), d.userId])).values(),
  ])
  return view(docs, authors, null, viewer)
}
