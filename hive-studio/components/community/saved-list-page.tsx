import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Bookmark, Clock } from "lucide-react"

import { CommunityFeed } from "@/components/community/community-feed"
import { Page } from "@/components/site/page"
import { buttonVariants } from "@/components/ui/button"
import { loadSavedFeed } from "@/lib/community-feed"
import type { FeedView } from "@/lib/community-feed"
import { listItemIds } from "@/lib/saved-lists"
import { currentUser } from "@/lib/session"

type Which = { kind: "watch_later" } | { kind: "playlist"; id: string }

/** Watch Later and a playlist (D-079) are the Media Feed narrowed to one of
    the viewer's lists: the same posts, action bar and three-dot menu, newest
    saved first. Unsaving a post here takes it off the page. */
export async function SavedListPage({ which }: { which: Which }) {
  const viewer = await currentUser().catch(() => null)
  if (!viewer)
    return (
      <Page title="Saved posts" width="wide" pageModeTitle={false}>
        <Empty
          icon={<Clock className="size-5 text-muted-foreground" aria-hidden />}
          title="Sign in to see your saved posts"
          body="Watch Later and playlists belong to your account."
        />
      </Page>
    )
  const list = await listItemIds(viewer.id, which)
  if (!list) notFound()
  let feed: FeedView = {
    items: [],
    nextCursor: null,
    bar: null,
    watchLater: [],
    comments: {},
  }
  try {
    feed = await loadSavedFeed(list.ids, viewer)
  } catch (error) {
    console.error("[saved] list failed", error)
  }
  const title = which.kind === "watch_later" ? "Watch Later" : list.name
  return (
    <Page
      title={title}
      subtitle={
        which.kind === "watch_later"
          ? "Posts you saved from the Media Feed to watch later."
          : "A playlist of Media Feed posts."
      }
      width="wide"
      pageModeTitle={false}
      actions={
        <Link
          href="/playlists"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          All playlists
        </Link>
      }
    >
      {feed.items.length ? (
        <CommunityFeed
          initialItems={feed.items}
          initialCursor={null}
          initialBar={feed.bar}
          initialWatchLater={feed.watchLater}
          initialComments={feed.comments}
          list={which}
        />
      ) : (
        <Empty
          icon={
            which.kind === "watch_later" ? (
              <Clock className="size-5 text-muted-foreground" aria-hidden />
            ) : (
              <Bookmark className="size-5 text-muted-foreground" aria-hidden />
            )
          }
          title="Nothing saved yet"
          body={
            which.kind === "watch_later"
              ? "Open a video in the Media Feed and choose Save to Watch Later."
              : "Open a video in the Media Feed and choose Save to playlist."
          }
        />
      )}
    </Page>
  )
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-ink/5">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-lg font-bold uppercase">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      <Link
        href="/community"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Back to the Media Feed
      </Link>
    </div>
  )
}
