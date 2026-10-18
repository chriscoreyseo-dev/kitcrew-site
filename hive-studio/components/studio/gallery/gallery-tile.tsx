/* eslint-disable @next/next/no-img-element */
"use client"

import { memo, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
  AudioLines,
  Clapperboard,
  Copy,
  Download,
  Globe,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react"

import {
  GenerationTile,
  type CardAction,
} from "@/components/studio/generation-card"
import { ShareDialog, type ShareTarget } from "@/components/studio/share-dialog"

import type { TileRect } from "./justified-engine"
import type { GalleryItem, LoadTier, TileActions } from "./gallery-types"

/**
 * One gallery tile, absolutely positioned at the engine-computed rect.
 * Mounted media stays mounted while scrolling so finished generations never
 * flash back to placeholders.
 */
export interface GalleryTileProps {
  item: GalleryItem
  rect: TileRect
  top: number
  tier: LoadTier
  reducedMotion: boolean
  onDelete?: (item: GalleryItem) => void
  extraActions?: TileActions
}

function rectStyle(rect: TileRect, top: number): CSSProperties {
  return { left: rect.x, top, width: rect.width, height: rect.height }
}

async function copyText(text: string) {
  await navigator.clipboard?.writeText(text)
}

/** Item ids are the run id, or "<run id>:<n>" for image n of a multi-image run. */
export function shareTargetFor(item: GalleryItem): ShareTarget {
  const n = item.id.startsWith(`${item.runId}:`)
    ? Number(item.id.slice(item.runId.length + 1))
    : 0
  return {
    runId: item.runId,
    index: Number.isInteger(n) && n > 0 ? n : 0,
    mediaUrl: item.videoSrc ?? item.src,
  }
}

function Placeholder() {
  return <span className="absolute inset-0 bg-card" aria-hidden="true" />
}

function StillMedia({ item, tier }: { item: GalleryItem; tier: LoadTier }) {
  return (
    <>
      <Placeholder />
      <img
        className="absolute inset-0 size-full object-cover"
        src={item.src}
        alt={item.alt}
        loading={tier === "full" ? "eager" : "lazy"}
        decoding="async"
      />
    </>
  )
}

/** Poster by default; plays muted on hover/focus; honours reduced motion. */
function HoverVideo({
  item,
  tier,
  playing,
  reducedMotion,
}: {
  item: GalleryItem
  tier: LoadTier
  playing: boolean
  reducedMotion: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const active = playing && !reducedMotion
  const hasPoster = item.src.length > 0
  // Without a poster the first frame is the still, so keep the video visible.
  const showVideo = !hasPoster || (active && loaded)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) void v.play()?.catch(() => undefined)
    else {
      v.pause()
      try {
        v.currentTime = 0
      } catch {}
    }
  }, [active])

  return (
    <>
      <Placeholder />
      {hasPoster ? (
        <img
          className="absolute inset-0 size-full object-cover"
          src={item.src}
          alt={item.alt}
          loading={tier === "full" ? "eager" : "lazy"}
          decoding="async"
          style={{ opacity: showVideo ? 0 : 1 }}
        />
      ) : null}
      <video
        ref={ref}
        className="absolute inset-0 size-full object-cover"
        muted
        loop
        playsInline
        preload={hasPoster ? "none" : "metadata"}
        poster={hasPoster ? item.src : undefined}
        onLoadedData={() => setLoaded(true)}
        style={{ opacity: showVideo ? 1 : 0 }}
      >
        <source src={item.videoSrc} />
      </video>
    </>
  )
}

function GalleryTileComponent({
  item,
  rect,
  top,
  tier,
  reducedMotion,
  onDelete,
  extraActions,
}: GalleryTileProps) {
  const [hovered, setHovered] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const style = rectStyle(rect, top)

  if (item.status === "generating") {
    return (
      <div className="studio-tile" style={style}>
        <GenerationTile state="generating" className="size-full" />
      </div>
    )
  }
  if (item.status === "failed") {
    return (
      <div className="studio-tile group" style={style}>
        <GenerationTile
          state="failed"
          failureLabel={item.failureLabel}
          className="size-full"
        />
        {onDelete ? (
          <button
            type="button"
            aria-label="Remove"
            className="absolute top-2 right-2 z-[2] flex size-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 hover:bg-black/60"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    )
  }

  const isVideo = item.kind === "video"
  const isAudio = item.kind === "audio"
  const media = isAudio ? (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
      <AudioLines aria-hidden className="size-10 text-primary" />
      <audio
        src={item.src}
        controls
        preload="none"
        className="w-full max-w-[260px]"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  ) : isVideo ? (
    <HoverVideo
      item={item}
      tier={tier}
      playing={hovered}
      reducedMotion={reducedMotion}
    />
  ) : (
    <StillMedia item={item} tier={tier} />
  )

  const actions: CardAction[] = [
    { id: "download", label: "Download", icon: Download },
    {
      id: "copy",
      label: "Copy prompt",
      icon: Copy,
      onSelect: () => void copyText(item.prompt),
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      // S581: the member's own MarketHive link (the raw /media URL is private).
      onSelect: () => setShareTarget(shareTargetFor(item)),
    },
    ...(extraActions?.onReuse
      ? [
          {
            id: "reuse",
            label: "Reuse prompt & settings",
            icon: RotateCcw,
            onSelect: () => extraActions.onReuse?.(item),
          },
        ]
      : []),
    ...(extraActions?.onAnimate && item.kind === "image"
      ? [
          {
            id: "animate",
            label: "Animate",
            icon: Clapperboard,
            onSelect: () => extraActions.onAnimate?.(item),
          },
        ]
      : []),
    ...(extraActions?.onPublish
      ? [
          {
            id: "publish",
            label: item.isPublic
              ? "Unpublish from Community"
              : "Publish to Community",
            icon: Globe,
            onSelect: () => extraActions.onPublish?.(item, !item.isPublic),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            danger: true,
            onSelect: () => onDelete(item),
          },
        ]
      : []),
  ]

  return (
    <div className="studio-tile" style={style}>
      <GenerationTile
        className="size-full"
        media={media}
        actions={actions}
        generation={{
          src: isVideo ? (item.videoSrc ?? item.src) : item.src,
          poster: isVideo ? item.src || undefined : undefined,
          mediaType: isAudio ? "audio" : isVideo ? "video" : "image",
          aspectRatio: item.width / item.height,
          prompt: item.prompt,
          model: item.modelLabel,
          createdAt: item.createdAt,
          settings: item.settings,
          onShare: () => setShareTarget(shareTargetFor(item)),
        }}
        openLabel={`Open generation: ${item.prompt}`}
        onMouseEnter={isVideo ? () => setHovered(true) : undefined}
        onMouseLeave={isVideo ? () => setHovered(false) : undefined}
        onFocus={isVideo ? () => setHovered(true) : undefined}
        onBlur={isVideo ? () => setHovered(false) : undefined}
      />
      <ShareDialog
        target={shareTarget}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null)
        }}
      />
    </div>
  )
}

export const GalleryTile = memo(GalleryTileComponent)
