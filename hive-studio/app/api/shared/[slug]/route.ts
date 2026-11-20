import { NextResponse } from "next/server"

import { sharedView } from "@/lib/sharing"

type Params = { params: Promise<{ slug: string }> }

/** Public read for MarketHive's /watch/studio/<slug> page (S581): one shared
    output - its kind, file and the owner's MarketHive member id, never the
    prompt. Anything not shared is the same 404. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params
  const view = await sharedView(slug)
  if (!view)
    return NextResponse.json(
      { error: "Not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  return NextResponse.json(view, {
    headers: { "Cache-Control": "public, max-age=60" },
  })
}
