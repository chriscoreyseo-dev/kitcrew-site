/* eslint-disable @next/next/no-img-element -- user media at its own shape */
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { CSSProperties, RefObject } from "react"
import {
  AudioLines,
  Copy,
  ExternalLink,
  Repeat2,
  Share2,
  Users,
} from "lucide-react"

import { ShareDialog } from "@/components/studio/share-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { publishGenerationAction } from "@/generation/community-actions"
import type { PublicGenerationDTO } from "@/lib/community"
import { recreateHref, remixHref } from "@/lib/community-links"
import { cn } from "@/lib/utils"

import { CaptionEditor } from "./caption-editor"
import { ReportDialog } from "./report-dialog"
import { SettingsList } from "./settings-list"
import { UnpublishButton } from "./unpublish-button"

const FONT = "Tahoma, 'Poppins', Geneva, sans-serif"

/**
 * Inside MarketHive on a phone, /hivestudio makes the frame a screen tall under
 * its toolbar, so part of the frame is often below the fold, and a window
 * centred in the frame would put its Close button and actions off screen. A
 * framed page can't scroll its parent (cross-origin), but it can see which part
 * of it is on screen: an IntersectionObserver on a frame-sized probe reports
 * the visible rectangle, and the window centres itself in that part instead.
 * Not framed, or the whole frame on screen: no change.
 */
function useVisiblePlace(): CSSProperties | undefined {
  const [visible, setVisible] = useState<{
    top: number
    height: number
  } | null>(null)
  useEffect(() => {
    if (window.parent === window || typeof IntersectionObserver === "undefined")
      return
    const probe = document.createElement("div")
    probe.setAttribute("aria-hidden", "true")
    probe.style.cssText =
      "position:fixed;inset:0;pointer-events:none;visibility:hidden"
    document.body.appendChild(probe)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const { top, height } = entry.intersectionRect
        setVisible(
          height <= 0 || height >= window.innerHeight - 1
            ? null
            : { top: Math.round(top), height: Math.round(height) }
        )
      },
      { threshold: Array.from({ length: 51 }, (_, i) => i / 50) }
    )
    observer.observe(probe)
    return () => {
      observer.disconnect()
      probe.remove()
    }
  }, [])
  if (!visible) return undefined
  const frameH = window.innerHeight
  const gap = 8
  // Never squeeze it into a sliver: at least 360px (or the frame, if smaller).
  const height = Math.min(
    frameH - 2 * gap,
    Math.max(visible.height - 2 * gap, 360)
  )
  const centre = Math.min(
    Math.max(visible.top + visible.height / 2, gap + height / 2),
    frameH - gap - height / 2
  )
  return { top: centre, maxHeight: height }
}

/** One output at its own shape, as large as the window allows. */
function Stage({
  item,
  url,
  label,
}: {
  item: PublicGenerationDTO
  url: string
  label: string
}) {
  if (item.kind === "audio")
    return (
      <div className="flex w-full flex-col items-center gap-6 p-8">
        <AudioLines className="size-10 text-muted-foreground" aria-hidden />
        <audio src={url} controls className="w-full max-w-xl" />
      </div>
    )
  const media =
    "block max-h-[50dvh] max-w-full object-contain lg:max-h-[max(240px,min(calc(100dvh-290px),900px))]"
  return item.kind === "video" ? (
    <video
      key={url}
      src={url}
      controls
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      className={media}
    />
  ) : (
    <img key={url} src={url} alt={label} decoding="async" className={media} />
  )
}

/**
 * A Hive Community post opened over the feed (S611, Tom's review of
 * /hivestudio: "like the News Feed opens a post"). The full picture or video
 * at its own shape, the creator, the write-up, the prompt, the settings and
 * the same actions as the share page /g/<id> (Recreate, Recreate with my
 * photos, the owner's Share panel and Unpublish, everyone else's Report).
 * Only what /g/<id> already shows is shown. Close button, the backdrop and
 * Escape close it; focus goes back to the post that opened it.
 */
export function CommunityPostDialog({
  item,
  returnFocus,
  onClose,
  onCaption,
  onRemoved,
}: {
  item: PublicGenerationDTO | null
  returnFocus: RefObject<HTMLElement | null>
  onClose: () => void
  onCaption: (id: string, caption: string) => void
  /** The owner took it off Community (Unpublish or the Share panel). */
  onRemoved: (id: string) => void
}) {
  // Keep drawing the last post while the window plays its closing transition.
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => !open && setShown(null)}
    >
      {shown ? (
        <PostWindow
          key={shown.id}
          item={shown}
          returnFocus={returnFocus}
          onCaption={onCaption}
          onRemoved={onRemoved}
        />
      ) : null}
    </Dialog>
  )
}

function PostWindow({
  item,
  returnFocus,
  onCaption,
  onRemoved,
}: {
  item: PublicGenerationDTO
  returnFocus: RefObject<HTMLElement | null>
  onCaption: (id: string, caption: string) => void
  onRemoved: (id: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = item.urls[index] ?? item.urls[0]

  const place = useVisiblePlace()
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const published = new Date(item.publishedAt)
  const remix = remixHref(item)

  const copyPrompt = () => {
    void navigator.clipboard
      ?.writeText(item.prompt)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      })
      .catch(() => undefined)
  }

  return (
    <DialogContent
      size="2xl"
      finalFocus={returnFocus}
      data-slot="community-post-dialog"
      style={{ fontFamily: FONT, ...place }}
    >
      <DialogHeader>
        <DialogTitle>{item.author}</DialogTitle>
        <DialogDescription>
          {item.modelLabel} ·{" "}
          <time dateTime={published.toISOString()}>
            {published.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "UTC",
            })}{" "}
            UTC
          </time>
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-40 items-center justify-center border border-[#dfdfdf] bg-[#f5f5f5]">
              {url ? <Stage item={item} url={url} label={label} /> : null}
            </div>
            {item.urls.length > 1 ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Pictures in this post"
              >
                {item.urls.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    aria-label={`Picture ${i + 1} of ${item.urls.length}`}
                    aria-pressed={i === index}
                    onClick={() => setIndex(i)}
                    className="size-16 overflow-hidden border border-[#dfdfdf] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:border-2 aria-pressed:border-[#6d83b4]"
                  >
                    {item.kind === "image" ? (
                      <img
                        src={u}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs">{i + 1}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {item.caption || item.mine ? (
              <div className="text-[18px]">
                <CaptionEditor
                  id={item.id}
                  caption={item.caption}
                  mine={item.mine}
                  onSaved={(caption) => onCaption(item.id, caption)}
                />
              </div>
            ) : null}

            {item.prompt ? (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Prompt
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPrompt}
                    aria-live="polite"
                  >
                    <Copy aria-hidden />
                    {copied ? "Copied" : "Copy prompt"}
                  </Button>
                </div>
                <p className="max-h-60 overflow-y-auto border border-[#dfdfdf] bg-[#f5f5f5] p-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                  {item.prompt}
                </p>
              </section>
            ) : null}

            {Object.keys(item.settings).length ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Settings
                </h3>
                <SettingsList settings={item.settings} />
              </section>
            ) : null}

            <div className="flex flex-wrap items-start gap-2">
              <Link
                href={recreateHref(item)}
                className={cn(buttonVariants({ size: "lg" }), "px-5")}
              >
                <Repeat2 aria-hidden />
                Recreate
              </Link>
              {remix ? (
                <Link
                  href={remix}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "px-5"
                  )}
                >
                  <Users aria-hidden />
                  Recreate with my photos
                </Link>
              ) : null}
              {item.mine && url ? (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setSharing(true)}
                >
                  <Share2 aria-hidden />
                  Share
                </Button>
              ) : null}
              {item.mine ? (
                <UnpublishButton
                  generationId={item.id}
                  onDone={() => onRemoved(item.id)}
                />
              ) : (
                <ReportDialog generationId={item.id} />
              )}
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter
        caption={
          <Link
            href={`/g/${item.id}`}
            className="inline-flex items-center gap-1 text-xs text-[#2f4370] hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open full page
          </Link>
        }
      >
        <DialogClose render={<Button variant="outline" size="lg" />}>
          Close
        </DialogClose>
      </DialogFooter>

      {item.mine && url ? (
        <ShareDialog
          target={sharing ? { runId: item.id, index, mediaUrl: url } : null}
          onOpenChange={(open) => !open && setSharing(false)}
          community={{
            published: true,
            onChange: async (publish) => {
              if (publish) return
              const result = await publishGenerationAction(item.id, false)
              if (result.ok) {
                setSharing(false)
                onRemoved(item.id)
              }
            },
          }}
        />
      ) : null}
    </DialogContent>
  )
}
