import { getPublicGeneration } from "@/lib/community"
import { posterFrame } from "@/lib/media/ffmpeg"
import { signedMediaUrl } from "@/lib/storage/media-access"

/** The picture a published post shows when it is shared (D-079): a still from
    a video (an image post redirects to its own picture). Facebook, X and
    LinkedIn read it from the og:image of /g/<id>; before this a video shared
    to Facebook came through as a bare link with no picture. Stills are made
    with ffmpeg on first request and kept in memory (crawlers ask once). */

export const dynamic = "force-dynamic"

const CACHE_MAX = 100
const stills = new Map<string, Buffer>()

function remember(id: string, jpeg: Buffer) {
  stills.set(id, jpeg)
  if (stills.size > CACHE_MAX) {
    const oldest = stills.keys().next().value
    if (oldest) stills.delete(oldest)
  }
}

function jpegResponse(jpeg: Buffer) {
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const item = await getPublicGeneration(id).catch(() => null)
  const url = item?.urls[0]
  if (!item || !url) return new Response("Not found", { status: 404 })
  if (item.kind === "image") return Response.redirect(url, 302)
  if (item.kind !== "video") return new Response("Not found", { status: 404 })

  const cached = stills.get(id)
  if (cached) return jpegResponse(cached)
  // Our own /media needs a signed link for the server to read it.
  const source = signedMediaUrl(url)
  const jpeg = (await posterFrame(source, 2)) ?? (await posterFrame(source, 0))
  if (!jpeg) return new Response("Not found", { status: 404 })
  remember(id, jpeg)
  return jpegResponse(jpeg)
}
