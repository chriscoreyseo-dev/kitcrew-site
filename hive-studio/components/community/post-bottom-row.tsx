"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { MouseEvent } from "react"

import { mediaFeedbackAction } from "@/generation/media-actions"
import type { FeedBar, PostBar } from "@/lib/community-feed"
import type { MediaSignal } from "@/lib/markethive/media"
import { permalinkDate } from "@/lib/media-feed-frame"
import { cn } from "@/lib/utils"

/** A plain left click stays on the page (opens the post window); a modified
    or middle click keeps the link's own /g/<id> page in a new tab. */
export function opensInPlace(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/** The News Feed's row under a post (Tom, 2026-11-07: "Tip, Like, Dislike,
    Comment and a Permalink. Standard procedure."), drawn to MarketHive's
    css/style.css posted_bottom_bar: 14px, #3b5998, 4px apart, 12px above.
    Tip is left out: MarketHive has no tip path for a Media Feed post (S624).
    Like / Dislike are the bar's own thumbs (one opinion, the newest replaces
    the other); the number shows only when MarketHive reports everyone's
    total. On the viewer's own post, or with no bar, they show only as a
    number, and not at all without one. Comment (n) and Permalink open the
    post window (`onComment`, `onPermalink`); Permalink is a real /g/<id> link,
    so a middle or Ctrl click still opens the share page. */
export function PostBottomRow({
  postId,
  mine,
  bar,
  post,
  commentCount,
  publishedAt,
  onSignal,
  onComment,
  onPermalink,
}: {
  postId: string
  mine: boolean
  bar: FeedBar | null
  post: PostBar | null
  commentCount: number
  publishedAt: number
  onSignal?: (signal: MediaSignal) => void
  /** `from` gets focus back when the window closes. */
  onComment: (from: HTMLElement) => void
  /** Absent: Permalink is an ordinary link to /g/<id>. */
  onPermalink?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const canSignal = Boolean(bar?.ready && post && !mine && onSignal)

  function send(signal: MediaSignal) {
    if (pending) return
    setMessage(null)
    startTransition(async () => {
      const result = await mediaFeedbackAction(postId, signal)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      onSignal?.(signal)
    })
  }

  const opinion = (signal: "like" | "dislike", label: string) => {
    const n = signal === "like" ? post?.likes : post?.dislikes
    const text = n === undefined ? label : `${label} ${n}`
    if (canSignal) {
      const on = post?.signals.includes(signal) ?? false
      return (
        <button
          type="button"
          aria-pressed={on}
          disabled={pending}
          onClick={() => send(signal)}
          className={cn("mr-1 hover:underline", on && "font-bold")}
        >
          {text}
        </button>
      )
    }
    return n === undefined ? null : <span className="mr-1">{text}</span>
  }

  const date = permalinkDate(publishedAt)
  return (
    <div
      data-slot="post-bottom-row"
      className="mt-[12px] mb-[3px] text-[14px] text-[#3b5998]"
    >
      {opinion("like", "Like")}
      {opinion("dislike", "Dislike")}
      <button
        type="button"
        onClick={(event) => onComment(event.currentTarget)}
        aria-haspopup="dialog"
        className="mr-1 hover:underline"
      >
        Comment ({commentCount})
      </button>
      <Link
        href={`/g/${postId}`}
        onClick={onPermalink}
        aria-haspopup={onPermalink ? "dialog" : undefined}
        className="hover:underline"
      >
        Permalink <span suppressHydrationWarning>{date}</span>
      </Link>
      {message ? (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}
