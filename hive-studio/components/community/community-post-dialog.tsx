/* eslint-disable @next/next/no-img-element -- user media at its own shape */
"use client"

import Link from "next/link"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { AudioLines, CircleX } from "lucide-react"

import { ShareDialog } from "@/components/studio/share-dialog"
import { publishGenerationAction } from "@/generation/community-actions"
import { announcePostWindow, FRAME_PLACED_EVENT } from "@/lib/client-events"
import type { PlacedPart } from "@/lib/client-events"
import type { PostComments as Summary } from "@/lib/comments"
import type { PublicGenerationDTO } from "@/lib/community"
import type { FeedBar, PostBar } from "@/lib/community-feed"
import { recreateHref, remixHref } from "@/lib/community-links"
import type { MediaSignal } from "@/lib/markethive/media"
import { popupPlace } from "@/lib/media-feed-frame"
import type { Visible } from "@/lib/media-feed-frame"
import { viewCount } from "@/lib/time-ago"

import { CaptionEditor } from "./caption-editor"
import type { OpenFocus } from "./community-post"
import { PostBottomRow } from "./post-bottom-row"
import { PostComments } from "./post-comments"
import { ReportDialog } from "./report-dialog"
import { SettingsList } from "./settings-list"
import { ShareButtons, shareLink } from "./share-buttons"
import { TitleEditor } from "./title-editor"
import { UnpublishButton } from "./unpublish-button"

const FONT = "Tahoma, 'Poppins', Geneva, sans-serif"

/**
 * Inside MarketHive the frame is as tall as the whole feed (S624: one scroll,
 * MarketHive's page), so a fixed window would centre in the middle of the
 * frame - thousands of pixels off screen. A framed page can't scroll its
 * parent or read its scroll (cross-origin), but it can see which part of it is
 * on screen: an IntersectionObserver on a frame-sized probe reports the
 * visible rectangle (its implicit root is the top-level viewport, even across
 * origins). null: not framed (the window uses 92vh).
 *
 * One size, every time (S628; Chris: "it should open up a full size"). The
 * part on screen is not the screen: at the top of the page MarketHive's bars
 * cover the first 250px, so the window opened that much shorter and grew, in
 * jumps, as the page scrolled. Now the window tells MarketHive it has opened
 * (announcePostWindow); MarketHive brings the frame to the top of the screen
 * and answers (FRAME_PLACED_EVENT); the window measures then and keeps that
 * size - later reports are ignored, so scrolling the page no longer resizes
 * it. `settled` is false until that measure is in (the window stays
 * transparent rather than open small and jump). A MarketHive page that never
 * answers (an older one) gets the old behaviour after ANSWER_MS: every report
 * counts.
 */
const ANSWER_MS = 300

function useVisiblePart(): { visible: Visible | null; settled: boolean } {
  const [visible, setVisible] = useState<Visible | null>(null)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (window.parent === window || typeof IntersectionObserver === "undefined")
      return
    const probe = document.createElement("div")
    probe.setAttribute("aria-hidden", "true")
    probe.style.cssText =
      "position:fixed;inset:0;pointer-events:none;visibility:hidden"
    document.body.appendChild(probe)
    // held: MarketHive answered, the size is fixed. wanted: reports still to
    // take while held (one per fresh measure).
    let held = false
    let wanted = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (held) {
          if (wanted <= 0) return
          wanted -= 1
        }
        const frame = window.innerHeight
        const { top, height } = entry.intersectionRect
        // Nothing of the frame on screen (it shouldn't be: the member just
        // clicked in it): use the whole frame rather than a zero-height window.
        setVisible(
          height <= 0
            ? { top: 0, height: frame, frame }
            : { top: Math.round(top), height: Math.round(height), frame }
        )
        if (held) setSettled(true)
      },
      { threshold: Array.from({ length: 51 }, (_, i) => i / 50) }
    )
    observer.observe(probe)
    // A fresh observe always reports once, whatever thresholds were crossed.
    const measure = () => {
      wanted += 1
      observer.unobserve(probe)
      observer.observe(probe)
    }
    let again = 0
    // S629: MarketHive says which part of the frame is on screen (fractions of
    // the frame's height). That is used as it is - no measuring. Measuring
    // after the answer could still return the rectangle from BEFORE MarketHive
    // scrolled (the observer reports across origins a beat late), and the
    // first window opened from the top of the page came up half height and
    // stayed that way.
    let told: PlacedPart | null = null
    const applyTold = () => {
      if (!told) return
      const frame = window.innerHeight
      setVisible({
        top: Math.round(told.top * frame),
        height: Math.round(told.height * frame),
        frame,
      })
    }
    const onPlaced = (event: Event) => {
      held = true
      told = (event as CustomEvent<PlacedPart | null>).detail ?? null
      window.clearTimeout(again)
      if (told) {
        wanted = 0
        applyTold()
        setSettled(true)
        return
      }
      // An older MarketHive page: measure, and once more when the page's
      // scroll has been painted.
      measure()
      again = window.setTimeout(measure, 150)
    }
    // The frame itself changed height (a short feed made a screen tall).
    const onResize = () => applyTold()
    const unanswered = window.setTimeout(() => setSettled(true), ANSWER_MS)
    window.addEventListener(FRAME_PLACED_EVENT, onPlaced)
    window.addEventListener("resize", onResize)
    announcePostWindow(true)
    return () => {
      announcePostWindow(false)
      window.removeEventListener(FRAME_PLACED_EVENT, onPlaced)
      window.removeEventListener("resize", onResize)
      window.clearTimeout(unanswered)
      window.clearTimeout(again)
      observer.disconnect()
      probe.remove()
    }
  }, [])
  return { visible, settled }
}

/**
 * While the window is open in a frame, a wheel or swipe that nothing inside
 * can scroll (the backdrop, the Link bar, the end of the window's own scroll)
 * would carry on into MarketHive's page and slide the window away with the
 * frame. Such a move is cancelled; anything that can still scroll that way
 * (the window's body, a comment box, a dialog on top) scrolls as usual.
 */
function useHoldPage(active: boolean) {
  useEffect(() => {
    if (!active || window.parent === window) return
    const canScroll = (from: EventTarget | null, dy: number) => {
      for (
        let el = from instanceof Element ? from : null;
        el && el !== document.body && el !== document.documentElement;
        el = el.parentElement
      ) {
        const { overflowY } = getComputedStyle(el)
        if (overflowY !== "auto" && overflowY !== "scroll") continue
        if (el.scrollHeight <= el.clientHeight + 1) continue
        if (dy < 0 && el.scrollTop > 0) return true
        if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)
          return true
      }
      return false
    }
    let startY = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !canScroll(e.target, e.deltaY)) e.preventDefault()
    }
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? startY
      if (e.touches.length === 1 && !canScroll(e.target, startY - y))
        e.preventDefault()
    }
    const opts = { capture: true, passive: false } as const
    document.addEventListener("wheel", onWheel, opts)
    document.addEventListener("touchstart", onTouchStart, opts)
    document.addEventListener("touchmove", onTouchMove, opts)
    return () => {
      document.removeEventListener("wheel", onWheel, opts)
      document.removeEventListener("touchstart", onTouchStart, opts)
      document.removeEventListener("touchmove", onTouchMove, opts)
    }
  }, [active])
}

/** One output fitted inside the window at its own shape - never cropped
    (Tom: "it doesn't matter what the size of his picture is, it has to fit
    inside of this popup window"). MarketHive's S587 cap: the window's height
    less 210px for the Link bar, the name and the text, 260px at least. */
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
    "mx-auto block h-auto max-h-[max(260px,calc(var(--mh-popup-h)-210px))] w-auto max-w-full object-contain"
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
 * A Media Feed post opened over the feed: MarketHive's News Feed post popup
 * (Tom, 2026-11-07: "When I click on the comment or click on the permalink, it
 * opens ... the standard window ... same size, same width, same height";
 * S624). The Link bar with the post's permalink and the round X; then, in the
 * one scroll of the window's body, the creator's photo and name, the post
 * text, the creation fitted at its shape, the News Feed's Like / Dislike /
 * Comment (n) / Permalink row, the studio's own links (Recreate, Recreate with
 * my photos, Copy prompt, and Share / Unpublish for the creator or Report for
 * everyone else), the share squares, the post's details (title, views, the
 * prompt, the settings) folded away, and the comment box with every comment.
 * The X, the backdrop and Escape close it; focus goes back to what opened it.
 */
export function CommunityPostDialog({
  item,
  focus = "post",
  returnFocus,
  onClose,
  onCaption,
  onRemoved,
  avatar = null,
  comments = null,
  mePic = "",
  feedBar = null,
  post = null,
  onSignal,
  onCommentCount,
  saved = null,
}: {
  /** Save to Watch Later / Save to playlist, as links (S627: they left the
      feed row's three dots for the window's line of links). */
  saved?: ReactNode
  item: PublicGenerationDTO | null
  /** "comment": the cursor starts in the comment box (Comment (n)). */
  focus?: OpenFocus
  /** The creator's MarketHive photo and profile link (D-079). */
  avatar?: { pic: string; url: string } | null
  /** The post's comments so far (D-079). */
  comments?: Summary | null
  /** The viewer's own photo, beside the comment box. */
  mePic?: string
  feedBar?: FeedBar | null
  post?: PostBar | null
  onSignal?: (signal: MediaSignal) => void
  onCommentCount?: (count: number) => void
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
    <DialogPrimitive.Root
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => !open && setShown(null)}
    >
      {shown ? (
        <PostWindow
          key={shown.id}
          item={shown}
          focus={focus}
          avatar={avatar}
          comments={comments}
          mePic={mePic}
          feedBar={feedBar}
          post={post}
          onSignal={onSignal}
          onCommentCount={onCommentCount}
          saved={saved}
          open={item !== null}
          returnFocus={returnFocus}
          onCaption={onCaption}
          onRemoved={onRemoved}
        />
      ) : null}
    </DialogPrimitive.Root>
  )
}

function PostWindow({
  item,
  focus,
  avatar,
  comments,
  mePic,
  feedBar,
  post,
  onSignal,
  onCommentCount,
  saved,
  open,
  returnFocus,
  onCaption,
  onRemoved,
}: {
  saved: ReactNode
  item: PublicGenerationDTO
  focus: OpenFocus
  avatar: { pic: string; url: string } | null
  comments: Summary | null
  mePic: string
  feedBar: FeedBar | null
  post: PostBar | null
  onSignal?: (signal: MediaSignal) => void
  onCommentCount?: (count: number) => void
  open: boolean
  returnFocus: RefObject<HTMLElement | null>
  onCaption: (id: string, caption: string) => void
  onRemoved: (id: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [count, setCount] = useState(comments?.count ?? 0)
  const popupRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const url = item.urls[index] ?? item.urls[0]

  const { visible, settled } = useVisiblePart()
  useHoldPage(open)
  const place = visible ? popupPlace(visible) : null
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const remix = remixHref(item)
  const link = typeof window === "undefined" ? "" : shareLink(item.id)
  // Framed and not measured yet (the observer reports on the next frame, and
  // MarketHive is still bringing the frame up): stay transparent rather than
  // flash 92% of a feed-tall frame at its top, or open small and jump
  // (transparent, not hidden, so focus can still move into it).
  const waiting =
    (!place || !settled) &&
    typeof window !== "undefined" &&
    window.parent !== window
  const style = {
    fontFamily: FONT,
    ...(waiting ? { opacity: 0 } : null),
    ...(place
      ? {
          top: place.top,
          height: place.height,
          "--mh-popup-h": `${place.height}px`,
        }
      : null),
  } as CSSProperties

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
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="mh-post-backdrop q-modal-backdrop" />
      <DialogPrimitive.Popup
        ref={popupRef}
        initialFocus={focus === "comment" ? boxRef : popupRef}
        finalFocus={returnFocus}
        data-slot="community-post-dialog"
        style={style}
        className="mh-post-popup fixed top-[min(37px,8vh)] left-1/2 z-[var(--hf-z-index-modal)] flex h-[92vh] w-full max-w-[960px] -translate-x-1/2 flex-col rounded-[4px] border border-ink/10 bg-background px-[10px] text-foreground shadow-[0_4px_8px_0_rgba(0,0,0,0.2),0_6px_20px_0_rgba(0,0,0,0.19)] outline-none [--mh-popup-h:92vh] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity"
      >
        {/* The News Feed popup's head: "Link:" and the permalink, the round X. */}
        <div className="flex shrink-0 items-center gap-2 pt-[10px] pb-[6px]">
          <span className="shrink-0 text-[14px] font-light text-[#b5b5b5]">
            Link:
          </span>
          <a
            href={link || `/g/${item.id}`}
            target="_blank"
            rel="noopener"
            className="block w-[72%] min-w-0 truncate border border-[#dfdfdf] bg-[#f1f3f4] px-[10px] pt-[2px] pb-[4px] text-[12px] font-bold text-[#7e6a81] no-underline"
          >
            {link || `/g/${item.id}`}
          </a>
          <DialogPrimitive.Close
            aria-label="Close"
            className="ml-auto shrink-0 rounded-full text-[#333] hover:text-black focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CircleX className="size-[27px]" strokeWidth={1.4} aria-hidden />
          </DialogPrimitive.Close>
        </div>

        {/* The window's one scroll (MarketHive: 86vh, overflow-y scroll). */}
        <div
          data-slot="post-popup-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[10px]"
        >
          <div className="flex items-start gap-[10px]">
            {avatar?.pic ? (
              <img
                src={avatar.pic}
                alt=""
                className="size-[50px] shrink-0 border border-black object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-[50px] shrink-0 items-center justify-center border border-black bg-[#dfe3ee] text-lg font-semibold text-[#104980]"
              >
                {item.author.slice(0, 1).toUpperCase()}
              </span>
            )}
            <DialogPrimitive.Title className="min-w-0 text-[16px] font-bold">
              {avatar?.url ? (
                <a
                  href={avatar.url}
                  target="_top"
                  className="text-[#104980] no-underline hover:underline"
                >
                  {item.author}
                </a>
              ) : (
                <span className="text-[#104980]">{item.author}</span>
              )}
            </DialogPrimitive.Title>
          </div>

          <div className="mt-[10px] text-[18px] text-[#333]">
            <CaptionEditor
              id={item.id}
              caption={item.caption}
              mine={item.mine}
              fallback={item.prompt}
              onSaved={(caption) => onCaption(item.id, caption)}
            />
          </div>

          <div className="mt-[10px] flex min-w-0 flex-col items-center gap-2">
            {url ? <Stage item={item} url={url} label={label} /> : null}
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

          <PostBottomRow
            postId={item.id}
            mine={item.mine}
            bar={feedBar}
            post={post}
            commentCount={count}
            publishedAt={item.publishedAt}
            onSignal={onSignal}
            onComment={() => boxRef.current?.focus()}
          />

          {/* The studio's own links, in the bottom row's type (S624: they
              left the feed row for the window). */}
          <div
            data-slot="post-popup-actions"
            className="mt-[6px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#3b5998]"
          >
            <Link href={recreateHref(item)} className="hover:underline">
              Recreate
            </Link>
            {remix ? (
              <Link href={remix} className="hover:underline">
                Recreate with my photos
              </Link>
            ) : null}
            {item.prompt ? (
              <button
                type="button"
                onClick={copyPrompt}
                aria-live="polite"
                className="hover:underline"
              >
                {copied ? "Copied" : "Copy prompt"}
              </button>
            ) : null}
            {saved}
            {item.mine && url ? (
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="hover:underline"
              >
                Share
              </button>
            ) : null}
            {item.mine ? (
              <UnpublishButton
                generationId={item.id}
                onDone={() => onRemoved(item.id)}
                link
              />
            ) : (
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="hover:underline"
              >
                Report
              </button>
            )}
          </div>

          <ShareButtons
            link={link}
            label={item.title || label}
            image={item.kind === "image" ? url : undefined}
          />

          <details className="mb-[10px] text-[14px] text-[#333]">
            <summary className="cursor-pointer text-[#3b5998] select-none hover:underline">
              Details
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <TitleEditor
                key={item.title}
                id={item.id}
                title={item.title}
                mine={item.mine}
                fallback={item.modelLabel}
              />
              <p className="text-[13px] text-muted-foreground">
                {item.modelLabel} &bull; {viewCount(item.views)}
              </p>
              {item.caption && item.prompt ? (
                <section className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Prompt
                  </h3>
                  <p className="border border-[#dfdfdf] bg-[#f5f5f5] p-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                    {item.prompt}
                  </p>
                </section>
              ) : null}
              {Object.keys(item.settings).length ? (
                <section className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Settings
                  </h3>
                  <SettingsList settings={item.settings} />
                </section>
              ) : null}
            </div>
          </details>

          <PostComments
            postId={item.id}
            initial={comments ?? { count: 0, latest: [] }}
            mePic={mePic}
            loadAll
            boxRef={boxRef}
            onCount={(n) => {
              setCount(n)
              onCommentCount?.(n)
            }}
          />
        </div>

        {item.mine && url ? (
          <ShareDialog
            target={sharing ? { runId: item.id, index, mediaUrl: url } : null}
            onOpenChange={(next) => !next && setSharing(false)}
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
        {!item.mine ? (
          <ReportDialog
            generationId={item.id}
            open={reporting}
            onOpenChange={setReporting}
          />
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}
