import { AudioLines, Clapperboard, ImageIcon } from "lucide-react"

import { FeedVideo } from "@/components/community/feed-video"
import type { Surface } from "@/generation/catalog/types"
import { cn } from "@/lib/utils"

/** Muted, dark-friendly washes. Picked by slug so each card keeps its look. */
const WASHES = [
  "from-violet-500/30 via-fuchsia-500/10 to-transparent",
  "from-sky-500/30 via-cyan-400/10 to-transparent",
  "from-amber-400/30 via-orange-500/10 to-transparent",
  "from-emerald-400/25 via-teal-500/10 to-transparent",
  "from-rose-500/30 via-pink-500/10 to-transparent",
  "from-indigo-500/30 via-blue-500/10 to-transparent",
] as const

function washFor(slug: string) {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return WASHES[h % WASHES.length]
}

const ICONS = { video: Clapperboard, image: ImageIcon, audio: AudioLines }

/** Effect cover: our own media when Phase 7 provides it, otherwise a
    gradient with the surface icon. */
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
    <div
      className={cn(
        "relative overflow-hidden bg-card",
        !coverUrl && "bg-gradient-to-br",
        !coverUrl && washFor(slug),
        className
      )}
    >
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
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12),transparent_55%)]"
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
