"use client"

import { useState, useTransition } from "react"
import type { MouseEvent } from "react"
import { Loader2 } from "lucide-react"

import { listCommunityAction } from "@/generation/community-actions"
import type { PublicGenerationDTO } from "@/lib/community"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CommunityTile } from "./community-tile"

/** Justified feed with cursor load-more. The button is a real link to
    `?cursor=`, so it still pages without JavaScript; with JS it appends. */
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
      <div className="flex flex-wrap items-start gap-2 [--row-h:140px] sm:[--row-h:200px] lg:[--row-h:240px]">
        {items.map((item) => (
          <CommunityTile key={item.id} item={item} />
        ))}
        {/* Absorbs the last row's free space so it isn't stretched. */}
        <div aria-hidden className="h-0 grow-[10000] basis-0" />
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
