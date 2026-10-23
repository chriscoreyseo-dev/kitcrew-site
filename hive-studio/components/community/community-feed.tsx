"use client"

import { useRef, useState, useTransition } from "react"
import type { MouseEvent } from "react"
import { Loader2 } from "lucide-react"

import { listCommunityAction } from "@/generation/community-actions"
import type { PublicGenerationDTO } from "@/lib/community"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CommunityPost } from "./community-post"
import { CommunityPostDialog } from "./community-post-dialog"

/** Hive Community as a feed (S584, Chris): one creation per row at its own
    shape with the creator's write-up beside it, like the News Feed. Cursor
    load-more; the button is a real link to `?cursor=`, so it still pages without
    JavaScript; with JS it appends. A post's picture or video opens it in a
    window over the feed (S611, Tom's review); its links stay /g/<id>. */
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
  const [openId, setOpenId] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const open = items.find((i) => i.id === openId) ?? null

  const setCaption = (id: string, caption: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, caption } : i)))
  const remove = (id: string) => {
    // The post that opened the window is gone: focus lands on the feed instead.
    opener.current = null
    setOpenId(null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

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
      <div className="flex w-full flex-col gap-[10px]">
        {items.map((item) => (
          <CommunityPost
            key={item.id}
            item={item}
            onCaption={setCaption}
            onOpen={(post, from) => {
              opener.current = from
              setOpenId(post.id)
            }}
          />
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
      <CommunityPostDialog
        item={open}
        returnFocus={opener}
        onClose={() => setOpenId(null)}
        onCaption={setCaption}
        onRemoved={remove}
      />
    </div>
  )
}
