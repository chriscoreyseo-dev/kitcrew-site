import Link from "next/link"
import { AudioLines } from "lucide-react"

import type { PublicGenerationDTO } from "@/lib/community"
import { recreateHref } from "@/lib/community-links"

import { CaptionEditor } from "./caption-editor"
import { layoutAspect } from "./community-tile"
import { FeedVideo } from "./feed-video"

/** Width that shows the creation at its true shape inside the post box: tall
    ones by height, wide ones by width, never wider than the box. */
function mediaWidth(a: number): string {
  if (a < 1) return `min(100%, ${Math.round(420 * a)}px)`
  if (a === 1) return "min(100%, 360px)"
  return "min(100%, 560px)"
}

/** One Hive Community post (S584, Chris; D-070), laid out like a MarketHive News
    Feed post (Chris: "spread out more like we have on the newsfeed and the blog
    feed ... it goes all the way across"): the creator across the top, then a
    full-width grey post box with the creation at its own shape (9:16, 1:1, 16:9
    ...) and the write-up running the full width under it, then a line of small
    links like the News Feed's Tip / Like / Comment / Permalink. */
export function CommunityPost({ item }: { item: PublicGenerationDTO }) {
  const a = layoutAspect(item.aspect)
  const url = item.urls[0]
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const published = new Date(item.publishedAt)

  return (
    <article className="flex w-full flex-col gap-2 border border-ink/15 bg-card px-4 pt-3 pb-2">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-[15px] font-semibold text-[#2f4370]">
          {item.author}
        </p>
        <p className="text-xs text-muted-foreground">{item.modelLabel}</p>
      </header>

      <div className="flex flex-col gap-3 border border-ink/10 bg-[#f5f5f5] p-3">
        <Link
          href={`/g/${item.id}`}
          aria-label={`Open: ${label}`}
          className="relative block overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{ aspectRatio: a, width: mediaWidth(a) }}
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
        <div className="px-1 text-[15px]">
          <CaptionEditor id={item.id} caption={item.caption} mine={item.mine} />
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#2f4370]">
        <Link href={`/g/${item.id}`} className="hover:underline">
          Open
        </Link>
        <Link href={recreateHref(item)} className="hover:underline">
          Recreate
        </Link>
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
