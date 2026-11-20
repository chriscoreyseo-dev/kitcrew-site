/** Shared by every storage driver: object keys, content types and limits. */

export const MAX_OUTPUT_BYTES = 2 * 1024 ** 3

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
}

/** Reverse map for serving local files. */
export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
}

const FALLBACK: Record<"image" | "video" | "audio", [string, string]> = {
  image: ["image/png", "png"],
  video: ["video/mp4", "mp4"],
  audio: ["audio/mpeg", "mp3"],
}

/** `u/{userId}/{generationId}/{n}.{ext}`; ext from the real content type. */
export function outputKey(
  userId: string,
  generationId: string,
  index: number,
  contentType: string,
  kind: "image" | "video" | "audio"
): { key: string; contentType: string } {
  const type = contentType.split(";")[0]!.trim().toLowerCase()
  const ext = EXT[type]
  const [fallbackType, fallbackExt] = FALLBACK[kind]
  return {
    key: `u/${userId}/${generationId}/${index}.${ext ?? fallbackExt}`,
    contentType: ext ? type : fallbackType,
  }
}

/** Outputs are fetched from the platform over https only. The end-to-end
    suite's mock platform serves plain http on localhost, so it sets
    E2E_ALLOW_HTTP_OUTPUTS=1; that flag is never set on a real deployment. */
export function isAllowedOutputUrl(sourceUrl: string): boolean {
  try {
    assertOutputSource(sourceUrl)
    return true
  } catch {
    return false
  }
}

export function assertOutputSource(sourceUrl: string): URL {
  const source = new URL(sourceUrl)
  const httpAllowed =
    process.env.E2E_ALLOW_HTTP_OUTPUTS === "1" &&
    ["127.0.0.1", "localhost"].includes(source.hostname)
  if (
    source.protocol !== "https:" &&
    !(httpAllowed && source.protocol === "http:")
  )
    throw new Error("Output URL is not https")
  return source
}
