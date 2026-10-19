import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles } from "lucide-react"

import { CommunityFeed } from "@/components/community/community-feed"
import { Page } from "@/components/site/page"
import { buttonVariants } from "@/components/ui/button"
import { decodeCursor, listPublicGenerations } from "@/lib/community"
import { currentUser } from "@/lib/session"
import type { CommunityPage as Feed } from "@/lib/community"

export const metadata: Metadata = {
  title: "Hive Community · Hive Studio",
  description: "Images and videos published by Hive Studio creators.",
}

async function loadFeed(cursor: string | null): Promise<Feed> {
  try {
    const viewer = await currentUser().catch(() => null)
    return await listPublicGenerations(cursor, undefined, viewer?.id ?? null)
  } catch (error) {
    console.error("[community] feed failed", error)
    return { items: [], nextCursor: null }
  }
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = typeof params.cursor === "string" ? params.cursor : null
  const cursor = decodeCursor(raw) ? raw : null
  const feed = await loadFeed(cursor)

  return (
    <Page
      title="Hive Community"
      subtitle="Fresh images and videos published by creators. Open one to see the prompt and recreate it."
      width="wide"
      actions={
        cursor ? (
          <Link
            href="/community"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Back to newest
          </Link>
        ) : null
      }
    >
      {feed.items.length ? (
        <CommunityFeed
          key={cursor ?? "newest"}
          initialItems={feed.items}
          initialCursor={feed.nextCursor}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-ink/5">
            <Sparkles className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-bold uppercase">
              Nothing published yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {cursor
                ? "You've reached the end of the feed."
                : "Publish a finished image or video from your history and it will show up here."}
            </p>
          </div>
          {cursor ? (
            <Link
              href="/community"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Back to newest
            </Link>
          ) : null}
        </div>
      )}
    </Page>
  )
}
