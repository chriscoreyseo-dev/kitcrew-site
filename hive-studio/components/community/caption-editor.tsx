"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { updateCaptionAction } from "@/generation/community-actions"
import { cn } from "@/lib/utils"

const MAX = 2000

/** The creator's write-up beside a creation in Hive Community (S584, D-070).
    Everyone reads it; only its creator (mine) sees Edit - like editing your own
    News Feed post. Plain text: line breaks kept, no HTML.
    `fallback` (S611, Tom's review): what the post says while there is no
    write-up - the creation's prompt, already public on /g/<id>. It is shown as
    the post text, never saved as the caption. */
export function CaptionEditor({
  id,
  caption: initial,
  mine,
  fallback,
  fallbackClassName,
  onSaved,
}: {
  id: string
  caption: string
  mine: boolean
  fallback?: string
  /** Extra classes for the fallback text, e.g. a line clamp in the feed. */
  fallbackClassName?: string
  /** Told about every saved write-up, so a second view of the post can follow. */
  onSaved?: (caption: string) => void
}) {
  const [caption, setCaption] = useState(initial)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (draft === null)
    return (
      <div className="flex flex-col items-start gap-2">
        {caption ? (
          <p className="text-[length:inherit] leading-relaxed break-words whitespace-pre-line text-foreground">
            {caption}
          </p>
        ) : fallback?.trim() ? (
          <p
            data-slot="post-prompt"
            className={cn(
              "text-[length:inherit] leading-relaxed break-words whitespace-pre-line text-foreground",
              fallbackClassName
            )}
          >
            {fallback.trim()}
          </p>
        ) : null}
        {mine ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null)
              setDraft(caption)
            }}
          >
            <Pencil aria-hidden />
            {caption ? "Edit" : "Write something about it"}
          </Button>
        ) : null}
      </div>
    )

  const save = () =>
    startTransition(async () => {
      const result = await updateCaptionAction(id, draft)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setCaption(result.data.caption)
      setDraft(null)
      onSaved?.(result.data.caption)
    })

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
        rows={5}
        autoFocus
        aria-label="Write about this creation"
        placeholder="Tell people about it: what you made, why, what to notice."
        className="w-full resize-y rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-[length:inherit]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {draft.length}/{MAX}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
