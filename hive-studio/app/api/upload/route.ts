import { NextResponse } from "next/server"

import { requireUploadContentType } from "@/generation/upload-contract"
import { requireUser, SignInRequiredError } from "@/lib/auth-guard"
import { EnvError } from "@/lib/env"
import { platform, PlatformError } from "@/lib/higgsfield"

export async function POST(request: Request): Promise<NextResponse> {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return failure(403, "Cross-origin upload requests are not allowed.")

  let contentType: string
  try {
    const body: unknown = await request.json()
    contentType = requireUploadContentType(
      body && typeof body === "object" && "contentType" in body
        ? body.contentType
        : null
    )
  } catch (error) {
    return failure(
      400,
      error instanceof SyntaxError
        ? "Invalid upload request."
        : "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV."
    )
  }

  try {
    await requireUser()
  } catch (error) {
    if (error instanceof SignInRequiredError)
      return failure(401, "Sign in to upload references.")
    throw error
  }

  let client: ReturnType<typeof platform>
  try {
    client = platform()
  } catch (error) {
    if (error instanceof EnvError) {
      console.error("[upload] Higgsfield is not configured")
      return failure(503, "Uploads are temporarily unavailable.")
    }
    throw error
  }

  try {
    const ticket = await client.createUpload(contentType)
    return NextResponse.json(ticket, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : 502
    console.error("[upload] Could not prepare reference upload", { status })
    if (status === 401 || status === 403)
      return failure(502, "Uploads are temporarily unavailable.")
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
