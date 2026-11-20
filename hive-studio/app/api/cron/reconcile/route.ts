import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { reconcile } from "@/lib/generations/lifecycle"

export const runtime = "nodejs"
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = env().CRON_SECRET
  if (!secret) return false
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "not found" }, { status: 404 })
  const report = await reconcile()
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
}
