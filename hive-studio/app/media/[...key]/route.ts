import { createReadStream } from "node:fs"
import { Readable } from "node:stream"

import { env } from "@/lib/env"
import { CONTENT_TYPE_BY_EXT } from "@/lib/storage/keys"
import { LOCAL_KEY, localFileSize, localPath } from "@/lib/storage/local"

/** Serves outputs kept on the local volume (STORAGE_DRIVER=local, D-059).
    Same exposure as R2 public URLs: keys are two ObjectIds deep and only the
    exact key shape is served. Range requests let videos seek. */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const notFound = () => new Response("Not found", { status: 404 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (env().STORAGE_DRIVER !== "local") return notFound()
  const key = (await params).key.join("/")
  if (!LOCAL_KEY.test(key)) return notFound()
  const size = await localFileSize(key)
  if (size === null) return notFound()

  const ext = key.slice(key.lastIndexOf(".") + 1)
  const headers = new Headers({
    "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
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
