import "server-only"

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"

import { requireEnv } from "@/lib/env"

/** Cloudflare R2 (S3 API). Higgsfield keeps outputs for ~7 days, so every
    finished output is streamed here and served from R2_PUBLIC_BASE_URL. */

const MAX_BYTES = 2 * 1024 ** 3

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

const FALLBACK: Record<"image" | "video" | "audio", [string, string]> = {
  image: ["image/png", "png"],
  video: ["video/mp4", "mp4"],
  audio: ["audio/mpeg", "mp3"],
}

let client: S3Client | undefined

function s3() {
  const env = requireEnv("r2")
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
  return { client, env }
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

export function publicUrl(key: string): string {
  return `${requireEnv("r2").R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
}

export function isR2Configured(): boolean {
  try {
    requireEnv("r2")
    return true
  } catch {
    return false
  }
}

/** Stream a platform output into R2. */
export async function copyToR2(input: {
  sourceUrl: string
  userId: string
  generationId: string
  index: number
  kind: "image" | "video" | "audio"
}): Promise<{ key: string; url: string; contentType: string; bytes: number }> {
  const source = new URL(input.sourceUrl)
  if (source.protocol !== "https:") throw new Error("Output URL is not https")
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok || !response.body)
    throw new Error(`Output download failed (${response.status})`)
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_BYTES)
    throw new Error("Output is larger than the storage limit")

  const { key, contentType } = outputKey(
    input.userId,
    input.generationId,
    input.index,
    response.headers.get("content-type") ?? "",
    input.kind
  )
  const { client, env } = s3()
  let bytes = 0
  const body = Readable.fromWeb(
    response.body as unknown as WebReadableStream<Uint8Array>
  )
  body.on("data", (chunk: Buffer) => {
    bytes += chunk.length
    if (bytes > MAX_BYTES)
      body.destroy(new Error("Output is larger than the storage limit"))
  })
  await new Upload({
    client,
    params: {
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
  }).done()
  return { key, url: publicUrl(key), contentType, bytes }
}

export async function deleteFromR2(keys: string[]): Promise<void> {
  if (!keys.length) return
  const { client, env } = s3()
  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    })
  )
}
