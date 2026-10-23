"use client"

import Link from "next/link"
import type { MouseEvent } from "react"
import { AudioLines } from "lucide-react"

import type { PublicGenerationDTO } from "@/lib/community"
import { recreateHref, remixHref } from "@/lib/community-links"

import { CaptionEditor } from "./caption-editor"
import { FeedVideo } from "./feed-video"

/** S586 (Chris): "every feed should run from the same size as the newsfeed" -
    rows, the boxes inside them AND the images. Measured on MarketHive's
    /newsfeed (dev3, 1920px): post row 1px #dfdfdf, 10px padding, 10px between
    posts; the post image is 329x205, cropped to fill (object-fit: cover);
    post text 18px Tahoma. MarketHive's css/mh_ui.css carries the same numbers. */
const NEWSFEED = {
  border: "#dfdfdf",
  imageW: 329,
  imageH: 205,
  font: "Tahoma, 'Poppins', Geneva, sans-serif",
} as const

/** A plain left click opens the post over the feed; a modified or middle click
    (new tab, new window) keeps the link's own /g/<id> page. */
function opensInPlace(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/** One Hive Community post (S584, Chris; D-070), laid out like a MarketHive News
    Feed post (Chris: "spread out more like we have on the newsfeed and the blog
    feed ... it goes all the way across"): the creator across the top, then a
    full-width grey post box with the creation at its own shape (9:16, 1:1, 16:9
    ...) and the write-up running the full width under it, then a line of small
    links like the News Feed's Tip / Like / Comment / Permalink.
    S611 (Tom's review): with no write-up the post text is the creation's prompt
    ("They made prompts. Put the prompts in there."), and the picture or video
    (and Open) opens the post in a window over the feed, like the News Feed's
    post popup; the links still point at /g/<id> for a new tab. */
export function CommunityPost({
  item,
  onOpen,
  onCaption,
}: {
  item: PublicGenerationDTO
  /** Opens the post over the feed; `from` gets focus back when it closes. */
  onOpen?: (item: PublicGenerationDTO, from: HTMLElement) => void
  onCaption?: (id: string, caption: string) => void
}) {
  const url = item.urls[0]
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const published = new Date(item.publishedAt)
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen || !opensInPlace(event)) return
    event.preventDefault()
    onOpen(item, event.currentTarget)
  }

  return (
    <article
      className="flex w-full flex-col gap-[10px] border bg-card p-[10px]"
      style={{ borderColor: NEWSFEED.border, fontFamily: NEWSFEED.font }}
    >
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-[15px] font-semibold text-[#2f4370]">
          {item.author}
        </p>
        <p className="text-xs text-muted-foreground">{item.modelLabel}</p>
      </header>

      <div
        className="flex flex-col gap-[10px] border bg-[#f5f5f5] p-[10px]"
        style={{ borderColor: NEWSFEED.border }}
      >
        <Link
          href={`/g/${item.id}`}
          onClick={open}
          aria-haspopup={onOpen ? "dialog" : undefined}
          aria-label={`Open: ${label}`}
          className="relative block shrink-0 overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{
            width: NEWSFEED.imageW,
            height: NEWSFEED.imageH,
            maxWidth: "100%",
          }}
        >
          {url && item.kind === "video" ? (
            <FeedVideo src={url} label={label} className="absolute inset-0" />
          ) : url && item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- user media, fixed aspect box
            <img
              src={url}
              alt={label}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/5">
              <AudioLines
                className="size-8 text-muted-foreground"
                aria-hidden
              />
            </span>
          )}
        </Link>
        <div className="px-1 text-[18px]">
          <CaptionEditor
            key={item.caption}
            id={item.id}
            caption={item.caption}
            mine={item.mine}
            fallback={item.prompt}
            fallbackClassName="line-clamp-6"
            onSaved={(caption) => onCaption?.(item.id, caption)}
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#2f4370]">
        <Link
          href={`/g/${item.id}`}
          onClick={open}
          aria-haspopup={onOpen ? "dialog" : undefined}
          className="hover:underline"
        >
          Open
        </Link>
        <Link href={recreateHref(item)} className="hover:underline">
          Recreate
        </Link>
        {remixHref(item) && (
          <Link href={remixHref(item)!} className="hover:underline">
            Recreate with my photos
          </Link>
        )}
        <time
          dateTime={published.toISOString()}
          className="text-muted-foreground"
        >
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
      </footer>
    </article>
  )
}
