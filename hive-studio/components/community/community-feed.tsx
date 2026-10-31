"use client"

import { useRef, useState, useTransition } from "react"
import type { MouseEvent } from "react"
import { Loader2 } from "lucide-react"

import { countViewAction } from "@/generation/community-actions"
import { mediaFeedPageAction } from "@/generation/media-actions"
import type { PublicGenerationDTO } from "@/lib/community"
import type { PostComments as Summary } from "@/lib/comments"
import type { FeedBar } from "@/lib/community-feed"
import type { LiftOutcome, MediaSignal } from "@/lib/markethive/media"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CommunityPost } from "./community-post"
import { CommunityPostDialog } from "./community-post-dialog"
import { PostActionBar } from "./post-action-bar"
import type { LiftWallet } from "./post-action-bar"
import { PostComments } from "./post-comments"
import { PostMenu } from "./post-menu"

/** Which saved list this feed shows, if any: unsaving a post there drops it. */
export type FeedList =
  { kind: "watch_later" } | { kind: "playlist"; id: string } | null

/** Hive Community as a feed (S584, Chris): one creation per row at its own
    shape with the creator's write-up beside it, like the News Feed. Cursor
    load-more; the button is a real link to `?cursor=`, so it still pages without
    JavaScript; with JS it appends. A post's picture or video opens it in a
    window over the feed (S611, Tom's review); its links stay /g/<id>.
    D-079 (Chris, 2026-10-30): each post carries the News Feed's action bar
    (MarketHive members) and a three-dot menu - Watch Later, playlist, Share.
    The same feed draws the Watch Later and playlist pages (`list`). */
export function CommunityFeed({
  initialItems,
  initialCursor,
  initialBar = null,
  initialWatchLater = [],
  initialComments = {},
  list = null,
}: {
  initialItems: PublicGenerationDTO[]
  initialCursor: string | null
  initialBar?: FeedBar | null
  initialWatchLater?: string[]
  initialComments?: Record<string, Summary>
  list?: FeedList
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [bar, setBar] = useState(initialBar)
  const [wallet, setWallet] = useState<LiftWallet | null>(
    initialBar
      ? {
          lifts: initialBar.lifts,
          price: initialBar.price,
          balance: initialBar.balance,
        }
      : null
  )
  const [watchLater, setWatchLater] = useState(() => new Set(initialWatchLater))
  const [comments, setComments] = useState(initialComments)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const open = items.find((i) => i.id === openId) ?? null

  const setCaption = (id: string, caption: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, caption } : i)))
  const drop = (keep: (item: PublicGenerationDTO) => boolean) => {
    // A post that opened the window may be gone: focus lands on the feed instead.
    opener.current = null
    setOpenId(null)
    setItems((prev) => prev.filter(keep))
  }
  const remove = (id: string) => drop((i) => i.id !== id)

  const setSignal = (id: string, signal: MediaSignal) =>
    setBar((prev) => {
      const post = prev?.posts[id]
      if (!prev || !post) return prev
      // Like and Dislike are one opinion: the newest replaces the other.
      const opposite =
        signal === "like" ? "dislike" : signal === "dislike" ? "like" : null
      const signals = [
        ...post.signals.filter((s) => s !== opposite && s !== signal),
        signal,
      ]
      return { ...prev, posts: { ...prev.posts, [id]: { ...post, signals } } }
    })

  const exclude = (id: string, author: string) => {
    const key = bar?.posts[id]?.authorKey
    if (!key) return
    drop((i) => bar?.posts[i.id]?.authorKey !== key)
    setNotice(`${author} is excluded. Their posts are gone from your feeds.`)
  }

  const lifted = (id: string, outcome: LiftOutcome) => {
    setWallet((prev) =>
      prev
        ? {
            lifts: outcome.lifts,
            price: outcome.price ?? prev.price,
            balance: outcome.balance ?? prev.balance,
          }
        : prev
    )
    if (outcome.status !== "lifted" && outcome.status !== "already") return
    setBar((prev) => {
      const post = prev?.posts[id]
      if (!prev || !post) return prev
      return {
        ...prev,
        posts: { ...prev.posts, [id]: { ...post, lifted: true } },
      }
    })
    setNotice(outcome.message || null)
    // The Media Feed shows a lifted post first; a saved list keeps its own order.
    if (outcome.status === "lifted" && !list)
      setItems((prev) => {
        const item = prev.find((i) => i.id === id)
        return item ? [item, ...prev.filter((i) => i.id !== id)] : prev
      })
  }

  const savedLater = (id: string, saved: boolean) => {
    setWatchLater((prev) => {
      const next = new Set(prev)
      if (saved) next.add(id)
      else next.delete(id)
      return next
    })
    if (!saved && list?.kind === "watch_later") remove(id)
  }

  function loadMore(event: MouseEvent<HTMLAnchorElement>) {
    if (!cursor) return
    event.preventDefault()
    if (pending) return
    setError(null)
    startTransition(async () => {
      const result = await mediaFeedPageAction(cursor)
      if (!result.ok) {
        setError(result.message)
        return
      }
      const page = result.data
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))]
      })
      setCursor(page.nextCursor)
      if (page.bar) {
        const more = page.bar
        setBar((prev) =>
          prev ? { ...prev, posts: { ...prev.posts, ...more.posts } } : more
        )
        setWallet({
          lifts: more.lifts,
          price: more.price,
          balance: more.balance,
        })
      }
      setWatchLater((prev) => new Set([...prev, ...page.watchLater]))
      setComments((prev) => ({ ...page.comments, ...prev }))
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {notice ? (
        <p
          role="status"
          className="border border-[#dfdfdf] bg-[#f5f5f5] px-3 py-2 text-sm text-[#2f4370]"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-[10px]">
        {items.map((item) => {
          const post = bar?.posts[item.id]
          const label = item.prompt
            ? item.prompt.slice(0, 120)
            : item.modelLabel
          return (
            <CommunityPost
              key={item.id}
              item={item}
              onCaption={setCaption}
              onOpen={(p, from) => {
                opener.current = from
                setOpenId(p.id)
                // Opening a post is a view (one per viewer per post per 6h).
                void countViewAction(p.id).then((r) => {
                  if (r.ok)
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === p.id ? { ...i, views: r.data.views } : i
                      )
                    )
                })
              }}
              avatar={
                post ? { pic: post.authorPic, url: post.authorUrl } : null
              }
              bar={
                bar && post && wallet ? (
                  <PostActionBar
                    postId={item.id}
                    author={item.author}
                    mine={item.mine}
                    bar={bar}
                    post={post}
                    wallet={wallet}
                    onSignal={(s) => setSignal(item.id, s)}
                    onExclude={() => exclude(item.id, item.author)}
                    onLift={(o) => lifted(item.id, o)}
                  />
                ) : null
              }
              comments={
                <PostComments
                  postId={item.id}
                  initial={comments[item.id] ?? { count: 0, latest: [] }}
                />
              }
              menu={
                <PostMenu
                  postId={item.id}
                  label={label}
                  video={item.kind === "video"}
                  mine={item.mine}
                  watchLater={watchLater.has(item.id)}
                  onWatchLater={(saved) => savedLater(item.id, saved)}
                  onPlaylistChange={(playlistId, inList) => {
                    if (
                      !inList &&
                      list?.kind === "playlist" &&
                      list.id === playlistId
                    )
                      remove(item.id)
                  }}
                />
              }
            />
          )
        })}
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
        avatar={
          open && bar?.posts[open.id]
            ? {
                pic: bar.posts[open.id].authorPic,
                url: bar.posts[open.id].authorUrl,
              }
            : null
        }
        comments={open ? (comments[open.id] ?? null) : null}
        returnFocus={opener}
        onClose={() => setOpenId(null)}
        onCaption={setCaption}
        onRemoved={remove}
      />
    </div>
  )
}
