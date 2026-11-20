import { ObjectId } from "mongodb"
import { after, NextResponse } from "next/server"

import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"
import { finalizeGeneration } from "@/lib/generations/lifecycle"
import { verifyWebhookToken } from "@/lib/higgsfield/webhook"

export const runtime = "nodejs"

/** Higgsfield → us, terminal states only, retried ~2h on 5xx, may repeat.
    The URL token proves it's a URL we issued; the body is never trusted:
    finalizeGeneration re-fetches the status from the platform. We answer
    fast and finalize after the response (R2 copies can exceed 10s). */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const gid = url.searchParams.get("gid") ?? ""
  const token = url.searchParams.get("t") ?? ""
  const secret = env().HF_WEBHOOK_SECRET
  if (
    !secret ||
    !ObjectId.isValid(gid) ||
    !verifyWebhookToken(gid, token, secret)
  )
    return NextResponse.json({ error: "not found" }, { status: 404 })

  // Body is only used for the dedupe record; malformed bodies are fine.
  const body = (await request.json().catch(() => null)) as {
    request_id?: unknown
    status?: unknown
  } | null
  const requestId =
    typeof body?.request_id === "string" ? body.request_id.slice(0, 200) : gid
  const status =
    typeof body?.status === "string" ? body.status.slice(0, 40) : "unknown"
  await db()
    .collection("hf_webhook_events")
    .updateOne(
      { requestId, status },
      {
        $setOnInsert: {
          requestId,
          status,
          generationId: gid,
          receivedAt: new Date(),
        },
      },
      { upsert: true }
    )
    .catch(() => undefined) // a duplicate is exactly what dedupe expects

  after(async () => {
    try {
      await finalizeGeneration(new ObjectId(gid))
    } catch (error) {
      // The reconciler picks it up on its next pass.
      console.error("[webhook] finalize failed", { gid, error: String(error) })
    }
  })
  return NextResponse.json({ ok: true })
}
