"use client"

import { useState, useTransition } from "react"
import type { MouseEvent } from "react"
import { Loader2 } from "lucide-react"

import { listCommunityAction } from "@/generation/community-actions"
import type { PublicGenerationDTO } from "@/lib/community"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CommunityPost } from "./community-post"

/** Hive Community as a feed (S584, Chris): one creation per row at its own
    shape with the creator's write-up beside it, like the News Feed. Cursor
    load-more; the button is a real link to `?cursor=`, so it still pages without
    JavaScript; with JS it appends. */
export function CommunityFeed({
  initialItems,
  initialCursor,
}: {
  initialItems: PublicGenerationDTO[]
  initialCursor: string | null
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function loadMore(event: MouseEvent<HTMLAnchorElement>) {
    if (!cursor) return
    event.preventDefault()
    if (pending) return
    setError(null)
    startTransition(async () => {
      const result = await listCommunityAction(cursor)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...result.data.items.filter((i) => !seen.has(i.id))]
      })
      setCursor(result.data.nextCursor)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {items.map((item) => (
          <CommunityPost key={item.id} item={item} />
        ))}
      </div>
      {cursor ? (
        <div className="flex flex-col items-center gap-2">
          <a
            href={`/community?cursor=${encodeURIComponent(cursor)}`}
            onClick={loadMore}
            aria-disabled={pending || undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "px-5"
            )}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? "Loading" : "Load more"}
          </a>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
