"use client"

import { useState, useTransition } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { Loader2 } from "lucide-react"

import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
} from "@/generation/media-actions"
import { Button } from "@/components/ui/button"
import type { CommentDTO, PostComments as Summary } from "@/lib/comments"

/** Comments under a Media Feed post (Chris, 2026-10-30, D-079), like the News
    Feed's: the newest two show, "View all" opens the rest, and anyone signed
    in can write one (Enter posts, Shift+Enter adds a line). A comment's
    writer, or the post's owner, can delete it. Names link to the member's
    MarketHive profile (out of the frame, in the whole window). */

const MAX = 2000

function when(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function Avatar({ c }: { c: CommentDTO }) {
  if (c.pic)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- MarketHive profile photo
      <img
        src={c.pic}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
      />
    )
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dfe3ee] text-xs font-semibold text-[#2f4370]"
    >
      {c.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function PostComments({
  postId,
  initial,
}: {
  postId: string
  initial: Summary
}) {
  const [list, setList] = useState<CommentDTO[]>(initial.latest)
  const [count, setCount] = useState(initial.count)
  const [all, setAll] = useState(initial.count <= initial.latest.length)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function viewAll() {
    setError(null)
    startTransition(async () => {
      const result = await listCommentsAction(postId)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setList(result.data)
      setAll(true)
    })
  }

  function post(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const body = text.trim()
    if (!body || pending) return
    setError(null)
    startTransition(async () => {
      const result = await addCommentAction(postId, body)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setList((prev) => [...prev, result.data])
      setCount((n) => n + 1)
      setText("")
    })
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      post()
    }
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteCommentAction(id)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setList((prev) => prev.filter((c) => c.id !== id))
      setCount((n) => Math.max(0, n - 1))
    })
  }

  return (
    <section
      aria-label={`Comments (${count})`}
      className="flex flex-col gap-2 border-t border-[#dfdfdf] pt-2 text-[14px]"
    >
      {!all && count > list.length ? (
        <button
          type="button"
          onClick={viewAll}
          disabled={pending}
          className="self-start text-xs text-[#2f4370] hover:underline"
        >
          View all {count} comments
        </button>
      ) : null}
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <Avatar c={c} />
              <div className="min-w-0 flex-1 rounded-lg bg-[#f2f3f5] px-3 py-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_top"
                      className="font-semibold text-[#2f4370] hover:underline"
                    >
                      {c.name}
                    </a>
                  ) : (
                    <span className="font-semibold text-[#2f4370]">
                      {c.name}
                    </span>
                  )}
                  <time
                    dateTime={new Date(c.createdAt).toISOString()}
                    className="text-[11px] text-muted-foreground"
                  >
                    {when(c.createdAt)}
                  </time>
                  {c.canDelete ? (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={pending}
                      className="ml-auto text-[11px] text-muted-foreground hover:text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </p>
                <p className="break-words whitespace-pre-wrap">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={post} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={MAX}
          rows={1}
          placeholder="Write a comment..."
          aria-label="Write a comment"
          className="min-h-9 flex-1 resize-y rounded-lg border border-[#dfdfdf] bg-white px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!text.trim() || pending}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Post
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
