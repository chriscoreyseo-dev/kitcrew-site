"use client"

import { Check, Loader2, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { MediaItem, ModelEntry } from "@/generation/catalog"
import { writeRecipeAction } from "@/generation/recipe-actions"

/** The motion-transfer model (Genjutsu): it needs a video plus photos. */
export function isMotionModel(model: ModelEntry): boolean {
  return Boolean(
    model.requiredRoles?.includes("video") && (model.roles.reference ?? 0) > 0
  )
}

/** "Write the prompt for me" (S611, Chris): the AI watches the video and writes
    the prompt, and says which photo goes where ("1. Man in front in the black
    suit"). Runs by itself when the video arrived with the page (Recreate with
    my photos, a template), since that member came to recreate it. */
export function RecipeHelper({
  model,
  media,
  setPrompt,
}: {
  model: ModelEntry
  media: MediaItem[]
  setPrompt: (prompt: string) => void
}) {
  const video = media.find((m) => m.role === "video")
  const photos = media.filter((m) => m.role === "reference").length
  const [slots, setSlots] = useState<{ url: string; labels: string[] } | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asked = useRef<string | null>(null)

  const write = useCallback(
    async (url: string) => {
      asked.current = url
      setBusy(true)
      setError(null)
      const result = await writeRecipeAction(url)
      setBusy(false)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setPrompt(result.data.prompt)
      setSlots({ url, labels: result.data.slots })
    },
    [setPrompt]
  )

  const arrivedWithPage =
    video && (video.id === "remix" || video.id.startsWith("preset-"))
  useEffect(() => {
    if (arrivedWithPage && video && asked.current !== video.url)
      void write(video.url)
  }, [arrivedWithPage, video, write])

  if (!isMotionModel(model)) return null
  const labels = slots && slots.url === video?.url ? slots.labels : null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-xs">
      {!video ? (
        <p className="text-muted-foreground">
          Add the video to recreate, then a photo of each person. The AI can
          write the prompt for you.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void write(video.url)}
          className="self-start"
        >
          {busy ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Sparkles aria-hidden />
          )}
          {busy ? "Watching the video…" : "Write the prompt for me"}
        </Button>
      )}
      {error ? <p className="text-destructive">{error}</p> : null}
      {labels ? (
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">
            Add {labels.length === 1 ? "1 photo" : `${labels.length} photos`},
            in this order:
          </p>
          <ol className="flex flex-col gap-0.5">
            {labels.map((label, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i < photos ? (
                  <Check aria-label="added" className="size-3.5 text-emerald-600" />
                ) : (
                  <span className="inline-block size-3.5 text-center font-mono">
                    {i + 1}
                  </span>
                )}
                <span className={i < photos ? "text-muted-foreground" : ""}>
                  Photo {i + 1}: {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
