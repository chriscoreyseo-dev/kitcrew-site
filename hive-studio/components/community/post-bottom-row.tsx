"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { MouseEvent } from "react"

import { mediaFeedbackAction, mediaTipAction } from "@/generation/media-actions"
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
    Tip (Chris, S627: "there is no like or dislike. Or tip. I would like that
    in there, please, to match the news feed") shows the post's tip total and,
    on another member's post, asks for an amount in MHV; MarketHive moves the
    coins from the viewer's Coin Clip by its own tip rules and answers with
    the new total. It shows only when MarketHive reports tips.
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

  // Tip: the total MarketHive reported, replaced by its answer after a tip.
  const [tipped, setTipped] = useState<string | null>(null)
  const [clip, setClip] = useState<string | null>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const tipTotal = tipped ?? post?.tips
  const canTip = Boolean(bar?.tip && post && !mine)
  const balance = clip ?? bar?.tip?.balance ?? "0"

  function sendTip() {
    if (pending) return
    const value = amount.trim()
    if (!/^\d{1,7}(\.\d{1,3})?$/.test(value) || Number(value) <= 0) {
      setMessage("Enter an amount, like 1 or 0.5.")
      return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await mediaTipAction(postId, value)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      const outcome = result.data
      if (outcome.balance) setClip(outcome.balance)
      if (outcome.status === "tipped") {
        if (outcome.total) setTipped(outcome.total)
        setAmount("")
        setTipOpen(false)
        // The new total beside Tip is the confirmation; the alert line is for refusals.
        return
      }
      setMessage(outcome.message || "The tip was not sent.")
    })
  }

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
      {tipTotal === undefined ? null : canTip ? (
        <button
          type="button"
          aria-expanded={tipOpen}
          disabled={pending}
          onClick={() => {
            setMessage(null)
            setTipOpen((open) => !open)
          }}
          className="mr-1 hover:underline"
        >
          Tip <sup>{tipTotal}</sup>
        </button>
      ) : (
        <span className="mr-1">
          Tip <sup>{tipTotal}</sup>
        </span>
      )}
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
      {canTip && tipOpen ? (
        <form
          data-slot="post-tip-form"
          // The row is clickable (it opens the post window); the form is not.
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault()
            sendTip()
          }}
          className="mt-[6px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[#121c31]"
        >
          <label htmlFor={`tip-${postId}`}>Tip amount (MHV)</label>
          <input
            id={`tip-${postId}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            maxLength={11}
            className="h-[24px] w-[90px] rounded-[4px] border border-[#a1b1d1] bg-white px-[6px] text-[14px] text-[#121c31] focus:border-[#2f4370] focus:outline-none"
          />
          {/* Tom's SM.BUTTON (MarketHive button protocol). */}
          <button
            type="submit"
            disabled={pending}
            className="h-[24px] rounded-[4px] border border-[#121c31] bg-[#6d83b4] px-[10px] text-[11px] font-bold tracking-[0.4px] text-white uppercase hover:brightness-110 disabled:opacity-60"
          >
            Send tip
          </button>
          <button
            type="button"
            onClick={() => setTipOpen(false)}
            className="text-[#3b5998] hover:underline"
          >
            Cancel
          </button>
          <span className="text-[#2f4370]">
            Coin Clip: {balance} MHV
            {bar?.tip?.max ? `, up to ${bar.tip.max} a tip` : ""}
          </span>
        </form>
      ) : null}
      {message ? (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}
