"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { Pencil } from "lucide-react"

import { updateTitleAction } from "@/generation/community-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const MAX = 100

/** The post's title beside the picture or video (D-079, Tom's YouTube-style
    card). Everyone reads it; its creator sees Add a title / Edit. With no
    title the creation's model names it for everyone else. */
export function TitleEditor({
  id,
  title: initial,
  mine,
  fallback,
}: {
  id: string
  title: string
  mine: boolean
  fallback: string
}) {
  const [title, setTitle] = useState(initial)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (draft === null)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[18px] leading-snug font-semibold break-words text-foreground">
          {title || fallback}
        </h3>
        {mine ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setError(null)
              setDraft(title)
            }}
          >
            <Pencil aria-hidden />
            {title ? "Edit title" : "Add a title"}
          </Button>
        ) : null}
      </div>
    )

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateTitleAction(id, draft)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setTitle(result.data.title)
      setDraft(null)
    })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          autoFocus
          maxLength={MAX}
          aria-label="Title"
          placeholder="Give it a title"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDraft(null)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
