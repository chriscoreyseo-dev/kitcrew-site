"use client"

import Link from "next/link"
import { useRef, type MouseEvent, type ReactNode } from "react"
import { AudioLines } from "lucide-react"

import type { PublicGenerationDTO } from "@/lib/community"
import type { FeedBar, PostBar } from "@/lib/community-feed"
import type { MediaSignal } from "@/lib/markethive/media"
import { rowClickOpens } from "@/lib/media-feed-frame"
import { timeAgo } from "@/lib/time-ago"
import { cn } from "@/lib/utils"

import { FeedVideo } from "./feed-video"
import { opensInPlace, PostBottomRow } from "./post-bottom-row"

/** MarketHive's News Feed row, measured off its own CSS (css/style.css,
    css/newsfeed.css; TOOLBAR_SPEC section 0): row 1px #dfdfdf with 10px
    padding, a 50x50 photo with a 1px black border, the name at 16px #104980,
    the post box #f7f7f7 / 1px #e4e4e4 / 7px 10px with 18px text, the first
    picture 329x205 cropped to fill (18.25em x 11.375em at 18px) with the text
    beside it (padding 7px 12px). Tahoma. */
const NEWSFEED = {
  border: "#dfdfdf",
  boxBg: "#f7f7f7",
  boxBorder: "#e4e4e4",
  imageW: 329,
  imageH: 205,
  font: "Tahoma, 'Poppins', Geneva, sans-serif",
} as const

/** How the post window was asked for: Comment (n) puts the cursor in the
    comment box. */
export type OpenFocus = "post" | "comment"

/** One Media Feed post as a News Feed row (Tom, 2026-11-07: "News Feed is our
    standard ... follow it as if it's the standard"; S624). The creator's photo,
    name and how long ago, the D-079 action bar and three-dot menu; the grey
    post box with the first picture or video cropped to the News Feed's 329x205
    and the post text beside it (the creator's write-up, or the prompt - D-078);
    then the News Feed's row: Like, Dislike, Comment (n), Permalink <date>.
    No comment box and no comments here ("The comments doesn't show up in the
    news feed. It tells you how many comments there are."): a plain click on
    the picture, the text, Comment (n) or Permalink opens the post window,
    where they are. Every opener is a real /g/<id> link, so a middle or Ctrl
    click still opens the share page. Recreate and the rest live in the
    window. Chris, 2026-11-09: a plain click anywhere else on the row - the
    header's empty space, the post box around the text, the bottom row -
    opens the window too; the row's links and buttons keep their own click
    (rowClickOpens). */
export function CommunityPost({
  item,
  onOpen,
  avatar,
  bar,
  feedBar = null,
  post = null,
  menu,
  commentCount = 0,
  onSignal,
}: {
  item: PublicGenerationDTO
  /** The creator's MarketHive photo and profile link (D-079). */
  avatar?: { pic: string; url: string } | null
  /** The D-079 action bar, drawn by the feed. */
  bar?: ReactNode
  /** The feed's bar data and this post's part of it (Like / Dislike). */
  feedBar?: FeedBar | null
  post?: PostBar | null
  menu?: ReactNode
  commentCount?: number
  onSignal?: (signal: MediaSignal) => void
  /** Opens the post over the feed; `from` gets focus back when it closes. */
  onOpen?: (
    item: PublicGenerationDTO,
    from: HTMLElement,
    focus: OpenFocus
  ) => void
}) {
  const url = item.urls[0]
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const text = item.caption.trim() || item.prompt.trim()
  const published = new Date(item.publishedAt)
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen || !opensInPlace(event)) return
    event.preventDefault()
    onOpen(item, event.currentTarget, "post")
  }
  // Focus returns to the picture link when a window opened from the row's
  // empty space closes (the row itself is not focusable).
  const opener = useRef<HTMLAnchorElement>(null)
  const openFromRow = (event: MouseEvent<HTMLElement>) => {
    if (!onOpen || !opener.current) return
    if (
      !rowClickOpens(
        event,
        event.target instanceof Element ? event.target : null,
        event.currentTarget
      )
    )
      return
    onOpen(item, opener.current, "post")
  }
  const nameClass = "text-[16px] font-bold text-[#104980] hover:underline"

  return (
    <article
      data-slot="media-feed-post"
      onClick={openFromRow}
      className={cn(
        "flex w-full items-start gap-[10px] border bg-card p-[10px]",
        onOpen && "cursor-pointer"
      )}
      style={{ borderColor: NEWSFEED.border, fontFamily: NEWSFEED.font }}
    >
      {avatar?.url ? (
        <a href={avatar.url} target="_top" className="shrink-0" tabIndex={-1}>
          <Photo pic={avatar.pic} name={item.author} />
        </a>
      ) : (
        <Photo pic={avatar?.pic ?? ""} name={item.author} />
      )}

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {avatar?.url ? (
            <a href={avatar.url} target="_top" className={nameClass}>
              {item.author}
            </a>
          ) : (
            <span className="text-[16px] font-bold text-[#104980]">
              {item.author}
            </span>
          )}
          <time
            dateTime={published.toISOString()}
            title={published.toUTCString()}
            className="text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {timeAgo(item.publishedAt)}
          </time>
          {bar ? (
            // The action bar is the row's control strip (badges, BOOST,
            // PUSH, LIFT): no click in it opens the window, as on the Blog
            // Feed's rows (.nf-post-action-bar).
            <div data-row-control className="ml-[clamp(12px,2vw,28px)]">
              {bar}
            </div>
          ) : null}
          {menu}
        </header>

        <div
          className="mt-[7px] flex flex-col border p-[7px_10px] text-[18px] text-[#352d2d] sm:flex-row sm:items-start"
          style={{
            backgroundColor: NEWSFEED.boxBg,
            borderColor: NEWSFEED.boxBorder,
          }}
        >
          <Link
            ref={opener}
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
              // eslint-disable-next-line @next/next/no-img-element -- user media, News Feed box
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
          {text ? (
            <Link
              href={`/g/${item.id}`}
              onClick={open}
              tabIndex={-1}
              data-slot="post-text"
              className="line-clamp-6 min-w-0 flex-1 px-[12px] py-[7px] leading-normal break-words whitespace-pre-line text-inherit"
            >
              {text}
            </Link>
          ) : null}
        </div>

        <PostBottomRow
          postId={item.id}
          mine={item.mine}
          bar={feedBar}
          post={post}
          commentCount={commentCount}
          publishedAt={item.publishedAt}
          onSignal={onSignal}
          onComment={(from) => onOpen?.(item, from, "comment")}
          onPermalink={onOpen ? open : undefined}
        />
      </div>
    </article>
  )
}

function Photo({ pic, name }: { pic: string; name: string }) {
  return pic ? (
    // eslint-disable-next-line @next/next/no-img-element -- MarketHive profile photo
    <img
      src={pic}
      alt=""
      className="size-[50px] shrink-0 border border-black object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-[50px] shrink-0 items-center justify-center border border-black bg-[#dfe3ee] text-lg font-semibold text-[#104980]"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
