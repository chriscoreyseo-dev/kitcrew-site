import { AudioLines, Clapperboard, ImageIcon } from "lucide-react"

import { FeedVideo } from "@/components/community/feed-video"
import type { Surface } from "@/generation/catalog/types"
import { brandArt } from "@/lib/brand-art"
import { cn } from "@/lib/utils"

function artFor(slug: string) {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return brandArt(h)
}

const ICONS = { video: Clapperboard, image: ImageIcon, audio: AudioLines }

/** Effect cover: generated media when `pnpm showcase` has set it, otherwise
    brand art with the surface icon. */
export function PresetCover({
  slug,
  title,
  surface,
  coverUrl,
  className,
  large,
}: {
  slug: string
  title: string
  surface: Surface
  coverUrl?: string
  className?: string
  large?: boolean
}) {
  const Icon = ICONS[surface]
  const isVideo = coverUrl ? /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl) : false
  return (
    <div className={cn("relative overflow-hidden bg-card", className)}>
      {coverUrl && isVideo ? (
        <FeedVideo src={coverUrl} label={title} className="absolute inset-0" />
      ) : coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own cover media, fixed aspect box
        <img
          src={coverUrl}
          alt={title}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          {/* Brand art until `pnpm showcase` sets coverUrl. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
          <img
            src={artFor(slug)}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "flex items-center justify-center rounded-full border border-white/15 bg-black/20 backdrop-blur-sm",
                large ? "size-20" : "size-12"
              )}
            >
              <Icon
                className={cn("text-white/80", large ? "size-8" : "size-5")}
                aria-hidden
              />
            </span>
          </div>
        </>
      )}
    </div>
  )
}
