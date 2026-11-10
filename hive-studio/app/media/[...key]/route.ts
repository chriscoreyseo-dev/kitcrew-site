import { createReadStream } from "node:fs"
import { Readable } from "node:stream"

import { env } from "@/lib/env"
import { currentUser } from "@/lib/session"
import { CONTENT_TYPE_BY_EXT } from "@/lib/storage/keys"
import { LOCAL_KEY, localFileSize, localPath } from "@/lib/storage/local"
import { mediaAccess, verifyMediaSignature } from "@/lib/storage/media-access"
import type { MediaAccess } from "@/lib/storage/media-access"

/** Serves outputs kept on the local volume (STORAGE_DRIVER=local, D-059).
    Only the exact key shape is served, and only to someone allowed to see it
    (D-063, lib/storage/media-access.ts): the owner, an admin, anyone for a
    published or cover item, or a signed link. Everything else, including a
    file that doesn't exist, is the same 404. Range requests let videos seek. */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const notFound = () =>
  new Response("Not found", {
    status: 404,
    // A 404 before sign-in must not stick once the member signs in.
    headers: { "Cache-Control": "no-store" },
  })

async function accessFor(request: Request, key: string): Promise<MediaAccess> {
  const query = new URL(request.url).searchParams
  if (verifyMediaSignature(key, query.get("exp"), query.get("sig")))
    return "private"
  return mediaAccess(key, await currentUser())
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (env().STORAGE_DRIVER !== "local") return notFound()
  const key = (await params).key.join("/")
  if (!LOCAL_KEY.test(key)) return notFound()
  const access = await accessFor(request, key)
  if (!access) return notFound()
  const size = await localFileSize(key)
  if (size === null) return notFound()

  const ext = key.slice(key.lastIndexOf(".") + 1)
  const headers = new Headers({
    "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
    // Private media stays in the viewer's own browser cache, never a shared
    // one; published media is short-lived so unpublishing takes effect.
    "Cache-Control":
      access === "public"
        ? "public, max-age=300"
        : "private, max-age=86400, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    // Media may be shown inside MarketHive's overlay or downloaded elsewhere.
    "Cross-Origin-Resource-Policy": "cross-origin",
  })

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "")
  let start = 0
  let end = size - 1
  let status = 200
  if (range && size > 0) {
    if (range[1]) start = Number(range[1])
    if (range[2]) end = Math.min(Number(range[2]), size - 1)
    if (!range[1] && range[2]) {
      start = Math.max(0, size - Number(range[2]))
      end = size - 1
    }
    if (start > end || start >= size) {
      headers.set("Content-Range", `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    status = 206
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`)
  }
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1))
  if (size === 0) return new Response(null, { status, headers })
  const stream = createReadStream(localPath(key), { start, end })
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers,
  })
}
