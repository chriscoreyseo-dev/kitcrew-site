import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SavedListPage } from "@/components/community/saved-list-page"

export const metadata: Metadata = {
  title: "Playlist · Hive Studio",
  description: "A playlist of Media Feed posts.",
}

/** One of the viewer's playlists (D-079). Someone else's looks like a missing one. */
export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^[0-9a-f]{24}$/.test(id)) notFound()
  return <SavedListPage which={{ kind: "playlist", id }} />
}
