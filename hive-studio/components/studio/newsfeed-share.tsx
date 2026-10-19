"use client"

import { useState } from "react"

import { useStudioMode } from "@/components/site/studio-mode"
import { Button } from "@/components/ui/button"

import type { ShareTarget } from "./share-dialog"

type Boost = {
  status: "boosted" | "already" | "need_purchase" | "price_changed" | "failed"
  message: string
  price: string | null
  balance: string | null
}

type Posted = { postUrl: string; existing: boolean; boost: Boost | null }

/** A confirm the member must answer before anything is spent (S584). */
type Confirm = { boosts: number; price: string; balance: string; note?: string }

const FAILED = "That didn't work. Try again."

/**
 * The Share panel's "My News Feed" row (S584, Chris; Studio D-068/D-069).
 * Composer-style, like MarketHive's own POST / BOOST buttons - one or the other
 * (Chris: "either post it or you boost it"):
 *  - Post: a News Feed post only the member's friends see.
 *  - Boost: posts it AND boosts it to everyone with MarketHive's own Boost. It first shows what it
 *    costs - a Boost the member already holds, or MarketHive's live Boost price
 *    from their Hive Vault - and spends nothing until they confirm. The studio
 *    never sets the price; MarketHive refuses a purchase at any price other than
 *    the one shown.
 * Rendered with key = the shared item, so its state resets per item.
 */
export function NewsFeedShare({ target }: { target: ShareTarget }) {
  const { creditsUrl } = useStudioMode()
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState<"posting" | "quoting" | null>(null)
  const [posted, setPosted] = useState<Posted | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const post = async (boost?: { buy: boolean; expectedPrice?: string }) => {
    setBusy("posting")
    setError(null)
    setConfirm(null)
    try {
      const res = await fetch(`/api/generations/${target.runId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: target.index,
          caption: caption.trim(),
          ...(boost
            ? {
                boost: true,
                buy: boost.buy,
                ...(boost.expectedPrice
                  ? { expectedPrice: boost.expectedPrice }
                  : {}),
              }
            : {}),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as Partial<Posted> & {
        error?: string
      }
      if (!res.ok || !body.postUrl) {
        setError(body.error ?? FAILED)
        return
      }
      const result: Posted = {
        postUrl: body.postUrl,
        existing: body.existing === true,
        boost: body.boost ?? null,
      }
      setPosted(result)
      // MarketHive says the price moved, or a Boost has to be bought: ask again
      // with the price it just reported.
      const b = result.boost
      if (
        b &&
        (b.status === "need_purchase" || b.status === "price_changed") &&
        b.price
      )
        setConfirm({
          boosts: 0,
          price: b.price,
          balance: b.balance ?? "0.00",
          note: b.status === "price_changed" ? b.message : undefined,
        })
    } catch {
      setError(FAILED)
    } finally {
      setBusy(null)
    }
  }

  const askBoost = async () => {
    setBusy("quoting")
    setError(null)
    try {
      const res = await fetch("/api/markethive/boost-quote", {
        cache: "no-store",
      })
      const body = (await res.json().catch(() => ({}))) as Partial<Confirm> & {
        error?: string
      }
      if (!res.ok || typeof body.price !== "string") {
        setError(body.error ?? FAILED)
        return
      }
      setConfirm({
        boosts: typeof body.boosts === "number" ? body.boosts : 0,
        price: body.price,
        balance: typeof body.balance === "string" ? body.balance : "0.00",
      })
    } catch {
      setError(FAILED)
    } finally {
      setBusy(null)
    }
  }

  const boosted =
    posted?.boost?.status === "boosted" || posted?.boost?.status === "already"
  const short = confirm
    ? confirm.boosts < 1 && Number(confirm.balance) < Number(confirm.price)
    : false

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
      <div>
        <p className="text-sm font-semibold">My News Feed</p>
        <p className="text-xs text-muted-foreground">
          Post: your friends see it. Boost: everyone on MarketHive sees it.
        </p>
      </div>

      {posted ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <p className="text-sm">
            {boosted
              ? posted.boost?.status === "already"
                ? "Already boosted to everyone."
                : "Posted and boosted to everyone."
              : posted.existing
                ? "Already on your News Feed (friends)."
                : "Posted to your News Feed (friends)."}
          </p>
          <a
            href={posted.postUrl}
            target="_top"
            className="inline-flex h-8 items-center rounded-lg border border-ink/15 px-3 text-sm hover:bg-ink/5"
          >
            View post
          </a>
          {!boosted && !confirm ? (
            <Button onClick={() => void askBoost()} disabled={busy !== null}>
              {busy === "quoting" ? "Checking…" : "Boost"}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="Say something about it (optional)"
            aria-label="Caption for your News Feed post"
            className="w-full resize-none rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm"
          />
          {!confirm ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => void post()}
                disabled={busy !== null}
              >
                {busy === "posting" ? "Posting…" : "Post"}
              </Button>
              <Button onClick={() => void askBoost()} disabled={busy !== null}>
                {busy === "quoting" ? "Checking…" : "Boost"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {posted?.boost?.status === "failed" ? (
        <p role="alert" className="text-xs text-destructive">
          {posted.boost.message || FAILED}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {confirm ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-ink/15 p-3"
          role="group"
          aria-label="Confirm Boost"
        >
          {confirm.note ? (
            <p className="text-xs text-destructive">{confirm.note}</p>
          ) : null}
          <p className="text-sm">
            {confirm.boosts > 0
              ? `Use 1 of your ${confirm.boosts} Boost${confirm.boosts === 1 ? "" : "s"}? Everyone on MarketHive will see this post.`
              : `Buy 1 Boost for $${confirm.price} from your Hive Vault? Everyone on MarketHive will see this post. Your balance: $${confirm.balance}.`}
          </p>
          {short ? (
            <p className="text-xs text-destructive">
              Not enough in your Hive Vault.{" "}
              {creditsUrl ? (
                <a href={creditsUrl} target="_top" className="underline">
                  Add credits
                </a>
              ) : null}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                void post(
                  confirm.boosts > 0
                    ? { buy: false }
                    : { buy: true, expectedPrice: confirm.price }
                )
              }
              disabled={busy !== null || short}
            >
              {busy === "posting"
                ? "Boosting…"
                : confirm.boosts > 0
                  ? "Use a Boost"
                  : `Buy and Boost · $${confirm.price}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
