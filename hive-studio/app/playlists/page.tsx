import type { Metadata } from "next"
import Link from "next/link"
import { Bookmark, Clock } from "lucide-react"

import { PlaylistDeleteButton } from "@/components/community/playlist-delete-button"
import { Page } from "@/components/site/page"
import { buttonVariants } from "@/components/ui/button"
import { listPlaylists } from "@/lib/saved-lists"
import type { PlaylistSummary } from "@/lib/saved-lists"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = {
  title: "Playlists · Hive Studio",
  description: "Your playlists of Media Feed posts.",
}

/** The viewer's playlists (D-079), with Watch Later first. Playlists are made
    from a post's three-dot menu (Save to playlist). */
export default async function PlaylistsPage() {
  const viewer = await currentUser().catch(() => null)
  let lists: PlaylistSummary[] = []
  if (viewer)
    lists = await listPlaylists(viewer.id).catch((error: unknown) => {
      console.error("[saved] playlists failed", error)
      return []
    })
  const row =
    "flex items-center gap-3 border border-[#dfdfdf] bg-card px-3 py-3 text-[15px] text-[#2f4370]"

  return (
    <Page
      title="Playlists"
      subtitle="Posts you saved from the Media Feed."
      width="wide"
      pageModeTitle={false}
    >
      {!viewer ? (
        <p className="text-sm text-muted-foreground">
          Sign in to see your playlists.
        </p>
      ) : (
        <ul className="flex flex-col gap-[10px]">
          <li className={row}>
            <Clock className="size-5 shrink-0" aria-hidden />
            <Link
              href="/watch-later"
              className="flex-1 font-semibold hover:underline"
            >
              Watch Later
            </Link>
          </li>
          {lists.map((list) => (
            <li key={list.id} className={row}>
              <Bookmark className="size-5 shrink-0" aria-hidden />
              <Link
                href={`/playlists/${list.id}`}
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
              >
                {list.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {list.count} {list.count === 1 ? "post" : "posts"}
              </span>
              <PlaylistDeleteButton id={list.id} name={list.name} />
            </li>
          ))}
          {lists.length ? null : (
            <li className="text-sm text-muted-foreground">
              No playlists yet. Open a post&apos;s three-dot menu in the Media
              Feed and choose Save to playlist.
            </li>
          )}
          <li>
            <Link
              href="/community"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Back to the Media Feed
            </Link>
          </li>
        </ul>
      )}
    </Page>
  )
}
