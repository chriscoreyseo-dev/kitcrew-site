import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { hit } from "@/lib/rate-limit"
import { isSameOrigin } from "@/lib/same-origin"
import { currentUser } from "@/lib/session"
import { markShared, shareSlug, shareUrl } from "@/lib/sharing"

type Params = { params: Promise<{ id: string }> }

/** The owner shares one output of their own finished run (S581). Marks the run
    shared and returns its MarketHive share link. Only inside MarketHive: the link
    and the referral it carries live there. */
export async function POST(request: Request, { params }: Params) {
  if (!isSameOrigin(request.headers.get("origin"), request.url, env().APP_URL))
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 }
    )
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: "Sign in to share." }, { status: 401 })
  const limit = await hit({
    scope: "share",
    id: user.id,
    max: 60,
    windowSec: 60,
  })
  if (!limit.ok)
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    )

  const { id } = await params
  let index = 0
  try {
    const body: unknown = await request.json()
    const raw = (body as { index?: unknown } | null)?.index
    if (raw !== undefined) {
      if (
        typeof raw !== "number" ||
        !Number.isInteger(raw) ||
        raw < 0 ||
        raw > 99
      )
        return NextResponse.json({ error: "Invalid output." }, { status: 400 })
      index = raw
    }
  } catch {
    // No body: the run's first output.
  }

  const slug = shareSlug(id, index)
  const url = shareUrl(slug)
  if (!url)
    return NextResponse.json(
      { error: "Sharing works inside MarketHive." },
      { status: 404 }
    )
  if (!(await markShared(user.id, id, index)))
    return NextResponse.json({ error: "Nothing to share." }, { status: 404 })
  return NextResponse.json(
    { slug, url },
    { headers: { "Cache-Control": "no-store" } }
  )
}
