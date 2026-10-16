import "server-only"

import { createWriteStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as WebReadableStream } from "node:stream/web"

import { env } from "@/lib/env"

import { assertOutputSource, MAX_OUTPUT_BYTES, outputKey } from "./keys"

/** Local-volume storage (D-059): outputs are written under LOCAL_STORAGE_DIR
    and served by /media/[...key]. For a single Docker host with a persistent
    volume (MarketHive dev3); R2 stays the choice for anything that scales out. */

/** Keys are always `u/{24 hex}/{24 hex}/{n}.{ext}`; nothing else is served. */
export const LOCAL_KEY =
  /^u\/[a-f0-9]{24}\/[a-f0-9]{24}\/\d{1,3}\.(png|jpg|webp|gif|mp4|webm|mov|mp3|wav|m4a|ogg)$/

export function localPath(key: string): string {
  if (!LOCAL_KEY.test(key)) throw new Error("Invalid media key")
  const root = path.resolve(env().LOCAL_STORAGE_DIR)
  const full = path.resolve(root, ...key.split("/"))
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid media key")
  return full
}

export function localPublicUrl(key: string): string {
  return `${env().APP_URL.replace(/\/$/, "")}/media/${key}`
}

export async function copyToLocal(input: {
  sourceUrl: string
  userId: string
  generationId: string
  index: number
  kind: "image" | "video" | "audio"
}): Promise<{ key: string; url: string; contentType: string; bytes: number }> {
  const source = assertOutputSource(input.sourceUrl)
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok || !response.body)
    throw new Error(`Output download failed (${response.status})`)
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_OUTPUT_BYTES)
    throw new Error("Output is larger than the storage limit")
  const { key, contentType } = outputKey(
    input.userId,
    input.generationId,
    input.index,
    response.headers.get("content-type") ?? "",
    input.kind
  )
  const target = localPath(key)
  await mkdir(path.dirname(target), { recursive: true })
  const partial = `${target}.part`
  let bytes = 0
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      bytes += chunk.length
      if (bytes > MAX_OUTPUT_BYTES)
        done(new Error("Output is larger than the storage limit"))
      else done(null, chunk)
    },
  })
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as unknown as WebReadableStream<Uint8Array>
      ),
      limit,
      createWriteStream(partial)
    )
    // Only a complete file ever appears under its final name.
    await rename(partial, target)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  return { key, url: localPublicUrl(key), contentType, bytes }
}

export async function deleteFromLocal(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => rm(localPath(key), { force: true })))
}

export async function localFileSize(key: string): Promise<number | null> {
  try {
    const info = await stat(localPath(key))
    return info.isFile() ? info.size : null
  } catch {
    return null
  }
}
