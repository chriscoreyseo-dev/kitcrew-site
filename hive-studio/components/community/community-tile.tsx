import Link from "next/link"
import type { CSSProperties } from "react"
import { AudioLines } from "lucide-react"

import type { PublicGenerationDTO } from "@/lib/community"

import { FeedVideo } from "./feed-video"

/** Clamp so a panorama or a very tall image can't break a justified row. */
export function layoutAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1
  return Math.min(2.4, Math.max(0.5, aspect))
}

/** One tile in the justified feed: grows with its aspect ratio so each row
    fills the width, while the inner box keeps the media's exact ratio. */
export function CommunityTile({ item }: { item: PublicGenerationDTO }) {
  const a = layoutAspect(item.aspect)
  const url = item.urls[0]
  const label = item.prompt ? item.prompt.slice(0, 120) : item.modelLabel
  return (
    <Link
      href={`/g/${item.id}`}
      className="group relative block min-w-0 overflow-hidden rounded-xl border border-white/10 bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      style={
        {
          flexGrow: a,
          flexBasis: `calc(${a} * var(--row-h))`,
          aspectRatio: a,
        } as CSSProperties
      }
    >
      {url && item.kind === "video" ? (
        <FeedVideo src={url} label={label} className="absolute inset-0" />
      ) : url && item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- user media on R2, fixed aspect box
        <img
          src={url}
          alt={label}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02]">
          <AudioLines className="size-8 text-muted-foreground" aria-hidden />
          <span className="sr-only">{label}</span>
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
        <span className="line-clamp-2 text-xs text-white/90">
          {item.prompt}
        </span>
        <span className="text-[11px] text-white/60">
          {item.modelLabel} · {item.author}
        </span>
      </span>
    </Link>
  )
}
