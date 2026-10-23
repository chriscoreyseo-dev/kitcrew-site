import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"

import { generations } from "@/lib/generations/lifecycle"
import { toRunDTO } from "@/lib/generations/model"
import { hit } from "@/lib/rate-limit"
import { currentUser } from "@/lib/session"

const MAX_IDS = 50

/** Reads our DB only; never calls Higgsfield. Polled by useRuns while runs are
    in flight. Ids that aren't the caller's are simply absent (same as missing). */
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 })
  const limit = await hit({
    scope: "status",
    id: user.id,
    max: 60,
    windowSec: 60,
  })
  if (!limit.ok)
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    )

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => ObjectId.isValid(id))
    .slice(0, MAX_IDS)
    .map((id) => new ObjectId(id))
  if (!ids.length) return NextResponse.json({ runs: [] })

  const docs = await generations()
    .find({ _id: { $in: ids }, userId: new ObjectId(user.id) })
    .toArray()
  return NextResponse.json(
    { runs: docs.map(toRunDTO) },
    { headers: { "Cache-Control": "no-store" } }
  )
}
