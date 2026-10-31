import type { Metadata } from "next"

import { SavedListPage } from "@/components/community/saved-list-page"

export const metadata: Metadata = {
  title: "Watch Later · Hive Studio",
  description: "Posts you saved from the Media Feed to watch later.",
}

/** Watch Later (D-079): what the viewer saved from a post's three-dot menu. */
export default function WatchLaterPage() {
  return <SavedListPage which={{ kind: "watch_later" }} />
}
