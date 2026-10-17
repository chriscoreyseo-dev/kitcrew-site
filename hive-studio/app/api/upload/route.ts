import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"

import {
  mediaKindFromMime,
  requireUploadContentType,
} from "@/generation/upload-contract"
import { assertCanGenerate, GenerationForbiddenError } from "@/lib/access"
import { EnvError } from "@/lib/env"
import { platform, PlatformError } from "@/lib/higgsfield"
import { UPLOAD_MAX_BYTES, uploads } from "@/lib/library"
import { hit } from "@/lib/rate-limit"
import { currentUser } from "@/lib/session"

/** Issues a signed upload URL and records its public URL server-side, so the
    browser can only ever reference files it really uploaded. */
export async function POST(request: Request): Promise<NextResponse> {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return failure(403, "Cross-origin upload requests are not allowed.")

  const user = await currentUser()
  if (!user) return failure(401, "Sign in to upload references.")
  try {
    assertCanGenerate(user)
  } catch (error) {
    if (error instanceof GenerationForbiddenError)
      return failure(403, error.message)
    throw error
  }

  let contentType: string
  let size: number
  try {
    const body: unknown = await request.json()
    const record = (body && typeof body === "object" ? body : {}) as Record<
      string,
      unknown
    >
    contentType = requireUploadContentType(record.contentType)
    size = typeof record.size === "number" ? record.size : NaN
  } catch (error) {
    return failure(
      400,
      error instanceof SyntaxError
        ? "Invalid upload request."
        : "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV."
    )
  }
  const kind = mediaKindFromMime(contentType)
  if (!Number.isFinite(size) || size <= 0)
    return failure(400, "Invalid upload request.")
  if (size > UPLOAD_MAX_BYTES[kind])
    return failure(
      413,
      `That file is too large. ${kind[0]!.toUpperCase()}${kind.slice(1)} uploads are limited to ${Math.round(UPLOAD_MAX_BYTES[kind] / 1024 ** 2)} MB.`
    )

  try {
    const limit = await hit({
      scope: "upload",
      id: user.id,
      max: 30,
      windowSec: 60,
    })
    if (!limit.ok)
      return failure(
        429,
        "Too many uploads right now. Wait a moment and try again."
      )
    const ticket = await platform().createUpload(contentType)
    const uploadId = new ObjectId()
    await uploads().insertOne({
      _id: uploadId,
      userId: new ObjectId(user.id),
      publicUrl: ticket.public_url,
      contentType,
      kind,
      status: "pending",
      createdAt: new Date(),
    })
    return NextResponse.json(
      { ...ticket, uploadId: uploadId.toHexString() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(`[upload] ${error.message}`)
      return failure(503, "Uploads are temporarily unavailable.")
    }
    const status = error instanceof PlatformError ? error.status : 502
    console.error("[upload] Could not prepare reference upload", { status })
    if (status === 429)
      return failure(
        429,
        "Too many uploads right now. Wait a moment and try again."
      )
    return failure(502, "Could not prepare the upload. Try again.")
  }
}

function failure(status: number, error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}
