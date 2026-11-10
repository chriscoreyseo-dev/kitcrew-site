"use client"

/* eslint-disable @next/next/no-img-element */
import { AudioLines, Film, ImagePlus, Plus, X } from "lucide-react"

import { AssetLibraryModal } from "@/components/studio/asset-library"
import type { MediaItem, MediaRole, ModelEntry } from "@/generation/catalog"
import type { AssetLibraryItem, AssetSelection } from "@/lib/studio/uploads"
import { cn } from "@/lib/utils"

type Props = {
  model: ModelEntry
  roles: Partial<Record<MediaRole, number>>
  media: MediaItem[]
  library: AssetLibraryItem[]
  onUpload: (file: File) => Promise<AssetSelection>
  onAdd: (role: MediaRole | "auto", selection: AssetSelection[]) => void
  onRemove: (id: string) => void
}

const ROLE_TITLE: Record<MediaRole, string> = {
  start: "Start frame",
  end: "End frame",
  reference: "Reference",
  video: "Video reference",
  audio: "Audio reference",
  source: "Source video",
}

function Thumb({
  item,
  onRemove,
}: {
  item: MediaItem
  onRemove: (id: string) => void
}) {
  return (
    <div className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-ink/5">
      {item.kind === "audio" ? (
        <div className="flex size-full items-center justify-center">
          <AudioLines aria-hidden className="size-6 text-primary" />
        </div>
      ) : item.kind === "video" ? (
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : (
        <img
          src={item.url}
          alt={item.name ?? ROLE_TITLE[item.role]}
          className="size-full object-cover"
        />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[9px] font-semibold uppercase">
        {ROLE_TITLE[item.role]}
      </span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${ROLE_TITLE[item.role].toLowerCase()}`}
        className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

/** Frame / source slots (only when the model takes them) + one mixed
    reference drop zone, all behind the shared asset library modal. */
export function MediaSlots({
  model,
  roles,
  media,
  library,
  onUpload,
  onAdd,
  onRemove,
}: Props) {
  const referenceKinds = (["image", "video", "audio"] as const).filter(
    (kind) =>
      kind === "image"
        ? (roles.reference ?? 0) > 0
        : kind === "video"
          ? (roles.video ?? 0) > 0
          : (roles.audio ?? 0) > 0
  )
  const refCount = media.filter(
    (m) => m.role === "reference" || m.role === "video" || m.role === "audio"
  ).length
  const refCapacity =
    (roles.reference ?? 0) + (roles.video ?? 0) + (roles.audio ?? 0)
  const used = new Set(media.map((m) => m.url))

  const slot = (
    role: "start" | "end" | "source",
    accept: "image" | "video"
  ) => {
    if (!(model.roles[role] ?? 0)) return null
    const filled = media.find((m) => m.role === role)
    return filled ? (
      <Thumb key={role} item={filled} onRemove={onRemove} />
    ) : (
      <AssetLibraryModal
        key={role}
        items={library}
        onUpload={onUpload}
        accept={[accept]}
        excludeIds={[...used]}
        onSelect={(selection) => onAdd(role, [selection])}
        trigger={
          <button
            type="button"
            className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/15 text-[9px] font-semibold text-muted-foreground uppercase hover:border-ink/30 hover:text-foreground"
            aria-label={`Add ${ROLE_TITLE[role].toLowerCase()}${model.requiredRoles?.includes(role) ? " (required)" : ""}`}
          >
            {accept === "video" ? (
              <Film className="size-4" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            {ROLE_TITLE[role]}
          </button>
        }
      />
    )
  }

  const frames = [
    slot("start", "image"),
    slot("end", "image"),
    slot("source", "video"),
  ].filter(Boolean)
  const refs = media.filter(
    (m) => m.role === "reference" || m.role === "video" || m.role === "audio"
  )

  return (
    <div className="flex flex-col gap-3">
      {frames.length ? (
        <div className="flex flex-wrap gap-2">{frames}</div>
      ) : null}
      {referenceKinds.length ? (
        <>
          {refCount < refCapacity ? (
            <AssetLibraryModal
              items={library}
              onUpload={onUpload}
              accept={[...referenceKinds]}
              excludeIds={[...used]}
              maxSelections={refCapacity - refCount}
              kindLimits={{
                image: roles.reference ?? 0,
                video: roles.video ?? 0,
                audio: roles.audio ?? 0,
              }}
              onSelectMany={(selection) => onAdd("auto", selection)}
              trigger={
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-dashed border-ink/15 px-4 py-4 text-left hover:border-ink/30"
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-ink/5">
                    <Plus className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      Add references
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {referenceKinds
                        .map((k) => k[0]!.toUpperCase() + k.slice(1))
                        .join(", ")}{" "}
                      · up to {refCapacity}
                    </span>
                  </span>
                </button>
              }
            />
          ) : null}
          {refs.length ? (
            <div className="flex flex-wrap gap-2">
              {refs.map((item) => (
                <Thumb key={item.id} item={item} onRemove={onRemove} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
