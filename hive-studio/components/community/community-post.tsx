import Link from "next/link"
import { AudioLines, ExternalLink, Repeat2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { PublicGenerationDTO } from "@/lib/community"
import { recreateHref } from "@/lib/community-links"
import { cn } from "@/lib/utils"

import { CaptionEditor } from "./caption-editor"
import { layoutAspect } from "./community-tile"
import { FeedVideo } from "./feed-video"

/** Width that shows the creation at its true shape: tall ones by height,
    wide ones by width, never wider than the row allows. */
function mediaWidth(a: number): string {
  if (a < 1) return `min(100%, ${Math.round(480 * a)}px)`
  if (a === 1) return "min(100%, 420px)"
  return "min(100%, 560px)"
}

/** One Hive Community post (S584, Chris; D-070): like a News Feed or Blog Feed
    row - the picture or video at its own shape (9:16, 1:1, 16:9 ...) with the
    creator, the date and their write-up beside it. */
export function CommunityPost({ item }: { item: PublicGenerationDTO }) {
  const a = layoutAspect(item.aspect)
  const url = item.urls[0]
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  const published = new Date(item.publishedAt)

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-ink/10 bg-card p-4 sm:flex-row sm:items-start">
      <Link
        href={`/g/${item.id}`}
        aria-label={`Open: ${label}`}
        className="relative block shrink-0 overflow-hidden rounded-lg bg-ink/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
          <span className="absolute inset-0 flex items-center justify-center">
            <AudioLines className="size-8 text-muted-foreground" aria-hidden />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-base font-bold">{item.author}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={published.toISOString()}>
              {published.toLocaleDateString("en", {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>{" "}
            · {item.modelLabel}
          </p>
        </div>
        <CaptionEditor id={item.id} caption={item.caption} mine={item.mine} />
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            href={`/g/${item.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink aria-hidden />
            Open
          </Link>
          <Link
            href={recreateHref(item)}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Repeat2 aria-hidden />
            Recreate
          </Link>
        </div>
      </div>
    </article>
  )
}
