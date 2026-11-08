"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { FormEvent, KeyboardEvent, Ref } from "react"
import { Loader2 } from "lucide-react"

import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
} from "@/generation/media-actions"
import type { CommentDTO, PostComments as Summary } from "@/lib/comments"

import { DictateButton } from "./dictate-button"
import type { DictateHandle } from "./dictate-button"

/** Comments under a Media Feed post (Chris, 2026-10-30, D-079), drawn like
    the News Feed's comment area: a pale blue-grey panel, the viewer's photo
    beside a "Write a comment..." box with the dictation mic in its top-right
    corner, a small blue Send under it, then each comment as photo, blue name
    with the text running on beside it, and the date under ("October 1 at
    2:09 am"). The newest two show; "View all" opens the rest. Enter sends,
    Shift+Enter adds a line. A comment's writer, or the post's owner, can
    delete it. Names link to the member's MarketHive profile (out of the
    frame, in the whole window).
    S624 (Tom, 2026-11-07): comments live only in the post window, never
    under a feed row ("The comments doesn't show up in the news feed. It tells
    you how many comments there are."). The window loads them all
    (`loadAll`) and tells the feed the new count (`onCount`). */

const MAX = 2000

/** "October 1 at 2:09 am", the News Feed's comment date. */
function when(ms: number) {
  const d = new Date(ms)
  const day = d.toLocaleString("en-US", { month: "long", day: "numeric" })
  const time = d
    .toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
  return `${day} at ${time}`
}

function Photo({ pic, name }: { pic: string; name: string }) {
  if (pic)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- MarketHive profile photo
      <img src={pic} alt="" className="size-8 shrink-0 object-cover" />
    )
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center bg-[#dfe3ee] text-xs font-semibold text-[#2f4370]"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function PostComments({
  postId,
  initial,
  mePic = "",
  loadAll = false,
  onCount,
  boxRef,
}: {
  postId: string
  initial: Summary
  /** The viewer's own MarketHive photo, beside the box. */
  mePic?: string
  /** Fetch every comment on mount instead of offering "View all". */
  loadAll?: boolean
  /** Told the post's comment count after every add or delete. */
  onCount?: (count: number) => void
  /** The "Write a comment..." box, for focusing it from outside. */
  boxRef?: Ref<HTMLTextAreaElement>
}) {
  const [list, setList] = useState<CommentDTO[]>(initial.latest)
  const [count, setCount] = useState(initial.count)
  const [all, setAll] = useState(initial.count <= initial.latest.length)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const mic = useRef<DictateHandle>(null)

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

  // The post window shows the whole thread, like the News Feed's popup.
  const fetched = useRef(false)
  useEffect(() => {
    if (!loadAll || fetched.current || all) return
    fetched.current = true
    viewAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  function post(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const body = text.trim()
    if (!body || pending) return
    // The mic turns off on send (Tom): what is on screen is what goes.
    mic.current?.stop()
    setError(null)
    startTransition(async () => {
      const result = await addCommentAction(postId, body)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setList((prev) => [...prev, result.data])
      setCount(count + 1)
      onCount?.(count + 1)
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
      setCount(Math.max(0, count - 1))
      onCount?.(Math.max(0, count - 1))
    })
  }

  return (
    <section
      aria-label={`Comments (${count})`}
      className="flex flex-col gap-2 bg-[#eaedf5] p-[10px] text-[14px]"
    >
      <form onSubmit={post} className="flex items-start gap-3">
        <Photo pic={mePic} name="You" />
        <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
          <div className="relative w-full">
            <textarea
              ref={boxRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              maxLength={MAX}
              rows={3}
              placeholder="Write a comment..."
              aria-label="Write a comment"
              className="block w-full resize-y border border-[#aab3c9] bg-white py-2 pr-[46px] pl-2 text-[15px] text-foreground outline-none placeholder:text-[#666] focus-visible:border-[#5f78ab]"
            />
            <DictateButton
              ref={mic}
              value={text}
              onChange={setText}
              maxLength={MAX}
              className="absolute top-2 right-2"
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || pending}
            className="inline-flex h-[21px] items-center gap-1 border border-[#4e6aa3] bg-[#6d83b4] px-3 text-[12px] font-bold text-white hover:bg-[#5c72a3] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : null}
            Send
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {!all && count > list.length ? (
        <button
          type="button"
          onClick={viewAll}
          disabled={pending}
          className="self-start text-[13px] text-[#2f4370] hover:underline"
        >
          View all {count} comments
        </button>
      ) : null}

      {list.length ? (
        <ul className="flex flex-col">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 border-t border-[#d6dbe8] py-2"
            >
              <Photo pic={c.pic} name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="break-words whitespace-pre-wrap">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_top"
                      className="mr-2 text-[15px] text-[#1f5fa8] hover:underline"
                    >
                      {c.name}
                    </a>
                  ) : (
                    <span className="mr-2 text-[15px] text-[#1f5fa8]">
                      {c.name}
                    </span>
                  )}
                  {c.text}
                </p>
                <p className="mt-1 flex gap-3 text-[13px] text-[#333]">
                  <time dateTime={new Date(c.createdAt).toISOString()}>
                    {when(c.createdAt)}
                  </time>
                  {c.canDelete ? (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={pending}
                      className="text-[#1f5fa8] hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
