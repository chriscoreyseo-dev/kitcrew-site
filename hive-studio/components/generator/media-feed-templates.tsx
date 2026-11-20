import Link from "next/link"

import { MEDIA_FEED_TEMPLATES } from "@/lib/media-feed-templates"

export function MediaFeedTemplates() {
  return (
    <nav aria-label="Media Feed templates" className="space-y-2">
      <h2 className="text-sm font-semibold">Start from a template</h2>
      <div className="flex flex-wrap gap-2">
        {MEDIA_FEED_TEMPLATES.map(({ slug, title }) => (
          <Link
            key={slug}
            href={`/image?template=${slug}`}
            prefetch={false}
            className="rounded-md border bg-card px-3 py-1.5 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </Link>
        ))}
      </div>
    </nav>
  )
}
