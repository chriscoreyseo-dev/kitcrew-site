"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"

import {
  mediaFeedbackAction,
  mediaLiftAction,
} from "@/generation/media-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { FeedBar, PostBar } from "@/lib/community-feed"
import type {
  LiftOutcome,
  MediaBadge,
  MediaSignal,
} from "@/lib/markethive/media"
import { cn } from "@/lib/utils"

/** MarketHive's News Feed action bar on a Media Feed post (Chris, 2026-10-30,
    D-079), drawn to css/newsfeed.css's numbers: 22px art, the LIFT at 17px
    with its live red count, white tooltips with a black border, wide even
    gaps. [validation key] [vanity] [hive rank] | [like] [dislike] [gold star]
    [exclude] [LIFT n]. On the viewer's own post only the badges show (Lift is
    the gift to others). Until MarketHive's migration 082 runs (bar.ready
    false) the badges show and the buttons wait. */

const TIP =
  "pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-50 hidden -translate-x-1/2 border border-black bg-white px-[10px] py-2 text-left text-[12px] leading-[1.35] font-normal text-black shadow-[1px_1px_0_#999] group-hover:block group-focus-visible:block"

const ACTION_TIPS: Record<MediaSignal | "exclude", ReactNode> = {
  like: (
    <>
      <strong>More Like This:</strong>
      <br />
      Tapping the Thumbs Up will increase their algorithm score within your
      algorithm settings.
    </>
  ),
  dislike: (
    <>
      <strong>Less Like This:</strong>
      <br />
      Tapping the Thumbs Down will decrease their algorithm score within your
      algorithm settings.
    </>
  ),
  star: "Tapping the GOLD STAR will increase their algorithm score and improve their rankings.",
  exclude:
    "Tapping the RED ALERT will add this member to your Members Exclusion, removing their posts from your feeds.",
}

const LABELS: Record<MediaSignal | "exclude", string> = {
  like: "More like this",
  dislike: "Less like this",
  star: "Gold star",
  exclude: "Exclude this member",
}

function Badge({ badge }: { badge: MediaBadge }) {
  return (
    <span
      className="group relative inline-flex items-center leading-none"
      tabIndex={0}
      aria-label={`${badge.title}: ${badge.status}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- MarketHive's badge art */}
      <img src={badge.src} alt="" className="block h-[22px] w-auto" />
      <span className={cn(TIP, "w-[230px]")} aria-hidden>
        <span className="mb-1 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- MarketHive's badge art */}
          <img src={badge.src} alt="" className="h-8 w-auto" />
          <strong>
            {badge.title}
            <br />
            {badge.status}
          </strong>
        </span>
        {badge.body}
      </span>
    </span>
  )
}

export type LiftWallet = { lifts: number; price: string; balance: string }

export function PostActionBar({
  postId,
  author,
  mine,
  bar,
  post,
  wallet,
  onSignal,
  onExclude,
  onLift,
}: {
  postId: string
  author: string
  mine: boolean
  bar: FeedBar
  post: PostBar
  wallet: LiftWallet
  onSignal: (signal: MediaSignal) => void
  onExclude: () => void
  onLift: (outcome: LiftOutcome) => void
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [ask, setAsk] = useState<"exclude" | "lift" | "buy" | null>(null)
  const [price, setPrice] = useState(wallet.price)
  const showButtons = !mine && bar.ready

  function send(signal: MediaSignal | "exclude") {
    if (pending) return
    setMessage(null)
    startTransition(async () => {
      const result = await mediaFeedbackAction(postId, signal)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setAsk(null)
      if (signal === "exclude") onExclude()
      else onSignal(signal)
    })
  }

  function lift(buy: boolean) {
    if (pending) return
    setMessage(null)
    startTransition(async () => {
      const result = await mediaLiftAction(postId, {
        buy,
        expectedPrice: buy ? price : null,
      })
      if (!result.ok) {
        setAsk(null)
        setMessage(result.message)
        return
      }
      const outcome = result.data
      if (outcome.price) setPrice(outcome.price)
      if (outcome.status === "need_purchase") {
        setAsk("buy")
        return
      }
      if (outcome.status === "price_changed") {
        setAsk("buy")
        setMessage(outcome.message)
        return
      }
      setAsk(null)
      onLift(outcome)
      if (outcome.status === "failed") setMessage(outcome.message)
    })
  }

  const action = (signal: MediaSignal | "exclude", src: string) => {
    const on = signal !== "exclude" && post.signals.includes(signal)
    return (
      <button
        type="button"
        className={cn(
          "group relative inline-flex items-center leading-none opacity-90 transition hover:-translate-y-px hover:opacity-100 disabled:opacity-45",
          on && "opacity-100"
        )}
        aria-label={LABELS[signal]}
        aria-pressed={signal === "exclude" ? undefined : on}
        disabled={pending || !src}
        onClick={() =>
          signal === "exclude" ? setAsk("exclude") : send(signal)
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- MarketHive's button art */}
        <img
          src={src}
          alt=""
          className={cn(
            "block h-[22px] w-auto",
            on && "drop-shadow-[0_0_3px_rgba(255,200,0,0.9)]"
          )}
        />
        <span className={cn(TIP, "w-[180px]")} aria-hidden>
          {ACTION_TIPS[signal]}
        </span>
      </button>
    )
  }

  const liftTip = post.lifted
    ? "This post has already been lifted."
    : "Gift this member a LIFT: their post rises to the top of the Media Feed."

  return (
    <div className="flex flex-wrap items-center gap-x-[clamp(16px,3vw,48px)] gap-y-2">
      {post.badges.map((b) => (
        <Badge key={b.src + b.title} badge={b} />
      ))}
      {showButtons ? (
        <>
          {action("like", bar.assets.like)}
          {action("dislike", bar.assets.dislike)}
          {action("star", bar.assets.star)}
          {action("exclude", bar.assets.exclude)}
          <button
            type="button"
            className="group relative inline-flex items-center gap-px leading-none opacity-90 transition hover:-translate-y-px hover:opacity-100 disabled:cursor-default disabled:opacity-45 disabled:hover:translate-y-0"
            aria-label={`Lift this post. You have ${wallet.lifts} ${wallet.lifts === 1 ? "Lift" : "Lifts"}.`}
            disabled={pending || post.lifted || !bar.assets.lift}
            onClick={() => setAsk(wallet.lifts > 0 ? "lift" : "buy")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Tom's LIFT art */}
            <img
              src={bar.assets.lift}
              alt=""
              className="block h-[17px] w-auto"
            />
            <span className="inline-block h-[11px] min-w-[11px] rounded-[3px] border border-white bg-[#ff0000] px-[2px] text-center text-[8px] leading-[9px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {wallet.lifts}
            </span>
            <span className={cn(TIP, "w-[200px] text-center")} aria-hidden>
              {bar.assets.liftTip ? (
                // eslint-disable-next-line @next/next/no-img-element -- MarketHive's tooltip art
                <img
                  src={bar.assets.liftTip}
                  alt=""
                  className="mx-auto mb-1 block h-[37px] w-[70px] max-w-full"
                />
              ) : null}
              {liftTip}
            </span>
          </button>
        </>
      ) : null}
      {pending ? (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
      {message && !ask ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {message}
        </p>
      ) : null}

      <Dialog
        open={ask !== null}
        onOpenChange={(open) => !open && setAsk(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {ask === "exclude"
                ? `Exclude ${author}?`
                : ask === "buy"
                  ? "Buy a Lift?"
                  : "Lift this post?"}
            </DialogTitle>
            <DialogDescription>
              {ask === "exclude"
                ? "Their posts leave your News Feed, Blog Feed and Media Feed. You can take them off your Members Exclusion in the News Feed's Algorithm panel."
                : ask === "buy"
                  ? `You have no Lifts. One costs $${price} from your MarketHive credits (you have $${wallet.balance}). It is used on this post right away.`
                  : `This uses 1 of your ${wallet.lifts} ${wallet.lifts === 1 ? "Lift" : "Lifts"}. ${author}'s post rises to the top of the Media Feed for everyone, as your gift.`}
            </DialogDescription>
          </DialogHeader>
          {message && ask ? (
            <DialogBody>
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAsk(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                ask === "exclude" ? send("exclude") : lift(ask === "buy")
              }
            >
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {ask === "exclude"
                ? "Exclude"
                : ask === "buy"
                  ? `Buy and Lift ($${price})`
                  : "Lift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
