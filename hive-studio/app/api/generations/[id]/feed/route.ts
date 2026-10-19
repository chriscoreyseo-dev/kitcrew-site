import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"

import { memberIdOf } from "@/lib/billing/wallet"
import { env } from "@/lib/env"
import {
  postToNewsfeed,
  WalletDeclinedError,
  WalletUnavailableError,
} from "@/lib/markethive/wallet"
import { hit } from "@/lib/rate-limit"
import { isSameOrigin } from "@/lib/same-origin"
import { currentUser } from "@/lib/session"
import { markShared, shareSlug } from "@/lib/sharing"

type Params = { params: Promise<{ id: string }> }

/** The owner posts one output of their own finished run to their MarketHive
    News Feed (S584, Chris). The run is marked shared first - its file must be
    public for friends to see it - then MarketHive creates the post. Friends see
    it; Boost on MarketHive makes it public. markethive mode only. */
export async function POST(request: Request, { params }: Params) {
  if (!isSameOrigin(request.headers.get("origin"), request.url, env().APP_URL))
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 }
    )
  if (env().STUDIO_MODE !== "markethive")
    return NextResponse.json(
      { error: "Posting works inside MarketHive." },
      { status: 404 }
    )
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: "Sign in to post." }, { status: 401 })
  const limit = await hit({
    scope: "feed",
    id: user.id,
    max: 20,
    windowSec: 60,
  })
  if (!limit.ok)
    return NextResponse.json(
      { error: "Too many posts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    )

  const { id } = await params
  let index = 0
  let caption = ""
  let boost = false
  let buy = false
  let expectedPrice: string | undefined
  try {
    const body = (await request.json()) as {
      index?: unknown
      caption?: unknown
      boost?: unknown
      buy?: unknown
      expectedPrice?: unknown
    } | null
    if (body?.index !== undefined) {
      const raw = body.index
      if (
        typeof raw !== "number" ||
        !Number.isInteger(raw) ||
        raw < 0 ||
        raw > 99
      )
        return NextResponse.json({ error: "Invalid output." }, { status: 400 })
      index = raw
    }
    if (body?.caption !== undefined) {
      if (typeof body.caption !== "string" || body.caption.length > 500)
        return NextResponse.json(
          { error: "Keep the caption under 500 characters." },
          { status: 400 }
        )
      caption = body.caption
    }
    // S584 Post + Boost: MarketHive's own Boost. A purchase needs the exact price
    // the member was shown ("10.00"); MarketHive refuses any other.
    boost = body?.boost === true
    buy = boost && body?.buy === true
    if (buy) {
      if (
        typeof body?.expectedPrice !== "string" ||
        !/^\d{1,6}\.\d{2}$/.test(body.expectedPrice)
      )
        return NextResponse.json(
          { error: "Confirm the Boost price first." },
          { status: 400 }
        )
      expectedPrice = body.expectedPrice
    }
  } catch {
    // No body: the run's first output, no caption.
  }

  if (!(await markShared(user.id, id, index)))
    return NextResponse.json({ error: "Nothing to post." }, { status: 404 })
  try {
    const memberId = await memberIdOf(new ObjectId(user.id))
    const result = await postToNewsfeed({
      memberId,
      slug: shareSlug(id, index),
      caption,
      boost,
      buy,
      expectedPrice,
    })
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof WalletDeclinedError)
      return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof WalletUnavailableError)
      return NextResponse.json({ error: error.message }, { status: 503 })
    throw error
  }
}
