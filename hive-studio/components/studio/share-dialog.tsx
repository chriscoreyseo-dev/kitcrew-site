"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadMedia } from "@/lib/studio/download-media"

/** What the Share button shares: one output of a finished run. */
export interface ShareTarget {
  runId: string
  /** Output index within a multi-image run; 0 for single outputs. */
  index: number
  /** The file itself, for Download. */
  mediaUrl: string
}

const TEXT = "I made this with Hive Studio on MarketHive."

type Phase =
  | { state: "loading" }
  | { state: "ready"; url: string }
  | { state: "error"; message: string }

type Result = { key: string; url?: string; error?: string }

const keyOf = (t: ShareTarget) => `${t.runId}:${t.index}`

/**
 * The Share panel (S581, Chris): the same set the home page's Newest Video
 * offers - the member's own link, Copy, the networks, Email and Download. Opening
 * it marks the run shared (POST /api/generations/<id>/share), which is what makes
 * the link work for people who aren't signed in. Each network gets its own link
 * suffix (/fb, /x, /li, /wa, /em) so MarketHive counts the visits each one brings.
 */
export function ShareDialog({
  target,
  onOpenChange,
  community,
}: {
  target: ShareTarget | null
  onOpenChange: (open: boolean) => void
  /** Add to / remove from Hive Studio Community from the same panel (S584,
      Chris). Omitted where publishing isn't offered. */
  community?: {
    published: boolean
    onChange: (publish: boolean) => void | Promise<void>
  }
}) {
  // The result is kept with the target it belongs to, so a new target reads as
  // "loading" until its own answer arrives (no state reset inside the effect).
  const [result, setResult] = useState<Result | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const key = target ? keyOf(target) : ""
  const phase: Phase =
    !result || result.key !== key
      ? { state: "loading" }
      : result.url
        ? { state: "ready", url: result.url }
        : {
            state: "error",
            message: result.error ?? "Sharing didn't work. Try again.",
          }
  const copied = copiedKey === key
  const [savingCommunity, setSavingCommunity] = useState(false)

  useEffect(() => {
    if (!target) return
    let cancelled = false
    const k = keyOf(target)
    fetch(`/api/generations/${target.runId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: target.index }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          url?: string
          error?: string
        }
        if (cancelled) return
        if (res.ok && body.url) setResult({ key: k, url: body.url })
        else setResult({ key: k, error: body.error })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: k })
      })
    return () => {
      cancelled = true
    }
  }, [target])

  const url = phase.state === "ready" ? phase.url : ""
  const nets = url
    ? [
        {
          id: "facebook",
          label: "Facebook",
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${url}/fb`)}`,
        },
        {
          id: "x",
          label: "X",
          href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${url}/x`)}&text=${encodeURIComponent(TEXT)}`,
        },
        {
          id: "linkedin",
          label: "LinkedIn",
          href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${url}/li`)}`,
        },
        {
          id: "whatsapp",
          label: "WhatsApp",
          href: `https://wa.me/?text=${encodeURIComponent(`${TEXT} ${url}/wa`)}`,
        },
        {
          id: "email",
          label: "Email",
          href: `mailto:?subject=${encodeURIComponent("Made with Hive Studio")}&body=${encodeURIComponent(`${TEXT}\n\n${url}/em`)}`,
        },
      ]
    : []

  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      {/* Opened from the full-screen generation view (z-50) as well as the
          gallery, so it stacks above that view, not under it (S581). */}
      <DialogContent size="sm" className="z-[60]!" overlayClassName="z-[60]!">
        <DialogHeader>
          <DialogTitle>Share your link</DialogTitle>
          <DialogDescription>
            Anyone who joins MarketHive from your link is registered as someone
            you brought in.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {phase.state === "loading" ? (
            <p className="text-sm text-muted-foreground">Making your link…</p>
          ) : phase.state === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {phase.message}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  aria-label="Your share link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-3 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(url)
                    setCopiedKey(key)
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {nets.map((n) => (
                  <a
                    key={n.id}
                    href={n.href}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
                  >
                    {n.label}
                  </a>
                ))}
                {target ? (
                  <button
                    type="button"
                    onClick={() => void downloadMedia(target.mediaUrl)}
                    className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
                  >
                    Download
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Posting to YouTube, TikTok or Instagram? Download it, upload it,
                and paste your link in the description.
              </p>
            </>
          )}
          {community ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Hive Studio Community</p>
                <p className="text-xs text-muted-foreground">
                  {community.published
                    ? "In Community under your name, with its prompt."
                    : "Show it in Community under your name, with its prompt."}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={savingCommunity}
                onClick={() => {
                  setSavingCommunity(true)
                  void Promise.resolve(
                    community.onChange(!community.published)
                  ).finally(() => setSavingCommunity(false))
                }}
              >
                {savingCommunity
                  ? "Saving…"
                  : community.published
                    ? "Remove from Community"
                    : "Add to Community"}
              </Button>
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
