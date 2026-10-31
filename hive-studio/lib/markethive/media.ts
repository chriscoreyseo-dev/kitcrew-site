import "server-only"

import { call, WalletUnavailableError } from "./wallet"

/** The News Feed action bar on the Media Feed (Chris, 2026-10-30, D-079):
    [validation key] [vanity badge] [hive rank] | [like] [dislike] [gold star]
    [exclude] [LIFT n]. MarketHive owns all of it - the author's badges, the
    viewer's Lift inventory, the shared Members Exclusion list and the signals -
    so the studio only asks (includes/media_feed_lib.php over the signed
    hive_studio_api.php channel) and draws what comes back. */

export type MediaSignal = "like" | "dislike" | "star"
export type MediaFeedback = MediaSignal | "exclude"

export type MediaBadge = {
  src: string
  title: string
  status: string
  body: string
}

/** A MarketHive member as a commenter is shown: name, photo, profile link. */
export type MediaPerson = { name: string; pic: string; url: string }

export type MediaAssets = {
  like: string
  dislike: string
  star: string
  exclude: string
  lift: string
  liftTip: string
}

export type MediaBarData = {
  /** Migration 082 has run on MarketHive: the signal buttons work. */
  ready: boolean
  assets: MediaAssets
  /** Per MarketHive member id. */
  badges: Map<number, MediaBadge[]>
  /** Per media id: the viewer's signals already given. */
  signals: Map<string, MediaSignal[]>
  lifted: Set<string>
  excluded: Set<number>
  /** Commenters the viewer may see (a full block leaves one out). */
  people: Map<number, MediaPerson>
  lifts: number
  price: string
  balance: string
}

export type LiftStatus =
  "lifted" | "already" | "need_purchase" | "price_changed" | "failed"

export type LiftOutcome = {
  status: LiftStatus
  message: string
  price: string | null
  lifts: number
  balance: string | null
}

const MONEY = /^\d{1,6}\.\d{2}$/
const money = (v: unknown): string | null =>
  typeof v === "string" && MONEY.test(v) ? v : null
const text = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.slice(0, max) : ""
/** Only MarketHive's own https (or dev http) art is ever drawn. */
const url = (v: unknown): string =>
  typeof v === "string" && /^https?:\/\/[^\s"'<>]+$/.test(v) ? v : ""
const count = (v: unknown): number =>
  typeof v === "number" && Number.isInteger(v) ? Math.max(0, v) : 0
const SIGNALS: MediaSignal[] = ["like", "dislike", "star"]

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
}

function badge(v: unknown): MediaBadge | null {
  const b = record(v)
  const src = url(b.src)
  if (!src) return null
  return {
    src,
    title: text(b.title, 80),
    status: text(b.status, 80),
    body: text(b.body),
  }
}

function person(v: unknown): MediaPerson | null {
  const p = record(v)
  const pic = url(p.pic)
  const link = url(p.url)
  const name = text(p.name, 80)
  return name ? { name, pic, url: link } : null
}

/** Everything the bar needs for one page of posts, and who its commenters are. */
export async function mediaBar(
  viewerMemberId: number,
  items: { mediaId: string; authorMemberId: number }[],
  people: number[] = []
): Promise<MediaBarData> {
  const data = record(
    await call("media_bar", {
      member_id: viewerMemberId,
      items: items.map((i) => ({
        media_id: i.mediaId,
        author_id: i.authorMemberId,
      })),
      people,
    })
  )
  const assets = record(data.assets)
  const badges = new Map<number, MediaBadge[]>()
  for (const [id, list] of Object.entries(record(data.badges))) {
    const memberId = Number(id)
    if (!Number.isInteger(memberId) || !Array.isArray(list)) continue
    badges.set(
      memberId,
      list.map(badge).filter((b): b is MediaBadge => b !== null)
    )
  }
  const signals = new Map<string, MediaSignal[]>()
  for (const [id, list] of Object.entries(record(data.signals))) {
    if (!/^[0-9a-f]{24}$/.test(id) || !Array.isArray(list)) continue
    signals.set(
      id,
      list.filter((s): s is MediaSignal => SIGNALS.includes(s as MediaSignal))
    )
  }
  const lifted = new Set(
    (Array.isArray(data.lifted) ? data.lifted : []).filter(
      (id): id is string => typeof id === "string"
    )
  )
  const excluded = new Set(
    (Array.isArray(data.excluded) ? data.excluded : []).filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id)
    )
  )
  const known = new Map<number, MediaPerson>()
  for (const [id, value] of Object.entries(record(data.people))) {
    const memberId = Number(id)
    const p = person(value)
    if (Number.isInteger(memberId) && p) known.set(memberId, p)
  }
  const price = money(data.price)
  if (!price) throw new WalletUnavailableError("media_bar: no price")
  return {
    ready: data.ready === true,
    assets: {
      like: url(assets.like),
      dislike: url(assets.dislike),
      star: url(assets.star),
      exclude: url(assets.exclude),
      lift: url(assets.lift),
      liftTip: url(assets.lift_tip),
    },
    badges,
    signals,
    lifted,
    excluded,
    people: known,
    lifts: count(data.lifts),
    price,
    balance: money(data.balance) ?? "0.00",
  }
}

/** Like / Dislike / Gold Star / Red Alert on another member's post. */
export async function mediaFeedback(input: {
  viewerMemberId: number
  authorMemberId: number
  mediaId: string
  signal: MediaFeedback
}): Promise<{ already: boolean }> {
  const data = record(
    await call("media_feedback", {
      member_id: input.viewerMemberId,
      author_id: input.authorMemberId,
      media_id: input.mediaId,
      signal: input.signal,
    })
  )
  return { already: data.already === true }
}

/** THE LIFT: spend one of the viewer's Lifts on another member's post; with
    none held and `buy`, buy one at `expectedPrice` (MarketHive refuses any
    other price). */
export async function mediaLift(input: {
  viewerMemberId: number
  authorMemberId: number
  mediaId: string
  buy: boolean
  expectedPrice: string | null
}): Promise<LiftOutcome> {
  const data = record(
    await call("media_lift", {
      member_id: input.viewerMemberId,
      author_id: input.authorMemberId,
      media_id: input.mediaId,
      buy: input.buy,
      ...(input.expectedPrice ? { expected_price: input.expectedPrice } : {}),
    })
  )
  const status = (
    ["lifted", "already", "need_purchase", "price_changed", "failed"] as const
  ).find((s) => s === data.status)
  if (!status) throw new WalletUnavailableError("media_lift: no status")
  return {
    status,
    message: text(data.message),
    price: money(data.price),
    lifts: count(data.lifts),
    balance: money(data.balance),
  }
}

/** May the viewer comment on this post? MarketHive applies Black Listing
    (WalletDeclinedError "blocked" when not), tells the post's owner, and
    returns how the commenter is shown. */
export async function mediaComment(input: {
  viewerMemberId: number
  authorMemberId: number
  mediaId: string
}): Promise<MediaPerson | null> {
  const data = record(
    await call("media_comment", {
      member_id: input.viewerMemberId,
      author_id: input.authorMemberId,
      media_id: input.mediaId,
    })
  )
  return person(data.person)
}
