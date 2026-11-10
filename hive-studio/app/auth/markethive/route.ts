import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { env, requireEnv } from "@/lib/env"
import {
  MH_SESSION_COOKIE,
  startMarketHiveSession,
} from "@/lib/markethive/session"
import { HandoffError, verifyHandoff } from "@/lib/markethive/signing"
import { isMarketHive } from "@/lib/mode"
import { clientIp, hit } from "@/lib/rate-limit"

/** MarketHive → studio sign-in (D-056). The dashboard badge asks MarketHive
    for a fresh signed token and loads /auth/markethive?token=…&next=… in the
    overlay iframe. A valid, unused token opens a studio session; anything
    else lands on a plain page that sends the member back to MarketHive. */

export const dynamic = "force-dynamic"

function safeNext(raw: string | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  )
    return "/image"
  return raw
}

function failure(request: NextRequest, reason: string) {
  const url = new URL("/login/error", env().APP_URL)
  url.searchParams.set("error", "MarketHive")
  url.searchParams.set("detail", reason)
  return NextResponse.redirect(url, { status: 303 })
}

export async function GET(request: NextRequest) {
  if (!isMarketHive()) return new NextResponse("Not found", { status: 404 })
  const limit = await hit({
    scope: "handoff",
    id: clientIp(request.headers),
    max: 30,
    windowSec: 60,
  }).catch(() => ({ ok: true }))
  if (!limit.ok)
    return failure(request, "Too many sign-in attempts. Wait a minute.")

  const token = request.nextUrl.searchParams.get("token") ?? ""
  let claims
  try {
    claims = verifyHandoff(
      token,
      requireEnv("markethive").MARKETHIVE_SHARED_SECRET
    )
  } catch (error) {
    if (error instanceof HandoffError) return failure(request, error.message)
    throw error
  }
  let session
  try {
    session = await startMarketHiveSession(claims)
  } catch (error) {
    if (error instanceof HandoffError) return failure(request, error.message)
    throw error
  }

  // 303 so the token-bearing URL is replaced in the frame's history.
  const response = NextResponse.redirect(
    new URL(safeNext(request.nextUrl.searchParams.get("next")), env().APP_URL),
    { status: 303 }
  )
  response.cookies.set(MH_SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
    path: "/",
    expires: session.expires,
  })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
