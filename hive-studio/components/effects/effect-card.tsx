import Link from "next/link"

import type { PresetDTO } from "@/lib/presets"

import { modelLabel } from "./model-label"
import { PresetCover } from "./preset-cover"

export function EffectCard({ preset }: { preset: PresetDTO }) {
  return (
    <Link
      href={`/effects/${preset.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <PresetCover
        slug={preset.slug}
        title={preset.title}
        surface={preset.surface}
        coverUrl={preset.coverUrl}
        className="aspect-[4/5] w-full"
      />
      <div className="flex min-w-0 flex-col gap-1 p-3">
        <p className="truncate font-heading text-sm font-bold uppercase">
          {preset.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {preset.surface === "video"
            ? "Video"
            : preset.surface === "image"
              ? "Image"
              : "Audio"}{" "}
          · {modelLabel(preset.modelId)}
        </p>
      </div>
    </Link>
  )
}
