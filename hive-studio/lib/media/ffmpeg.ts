import "server-only"

import { spawn } from "node:child_process"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

/** ffmpeg on the server (S611): the soundtrack a motion-transfer result is
    missing, and still frames for the AI prompt writer. The Docker image
    installs it; anywhere it is missing these return null and callers carry on
    without it (a run never fails for want of a soundtrack). URLs must already
    be fetchable by the server (signedMediaUrl for our own /media). */

const FFMPEG = () => process.env.FFMPEG_PATH || "ffmpeg"
const TIMEOUT_MS = 120_000

function run(args: string[], collect = false): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(FFMPEG(), ["-hide_banner", "-loglevel", "error", ...args], {
        stdio: ["ignore", collect ? "pipe" : "ignore", "pipe"],
      })
    } catch {
      resolve(null)
      return
    }
    const out: Buffer[] = []
    let err = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS)
    child.stdout?.on("data", (c: Buffer) => out.push(c))
    child.stderr?.on("data", (c: Buffer) => {
      if (err.length < 2000) err += c.toString()
    })
    child.on("error", () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(out))
      else {
        if (err) console.warn(`[ffmpeg] exit ${code}: ${err.slice(0, 500)}`)
        resolve(null)
      }
    })
  })
}

export type TempFile = { file: string; cleanup: () => Promise<void> }

/** `videoUrl`'s picture with `audioUrl`'s soundtrack, as a temporary MP4.
    The picture is copied, never re-encoded; the result ends with the shorter
    of the two. Null when ffmpeg is missing or `audioUrl` has no audio. */
export async function withSoundtrack(
  videoUrl: string,
  audioUrl: string
): Promise<TempFile | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "hive-soundtrack-"))
  const cleanup = () => rm(dir, { recursive: true, force: true })
  const file = path.join(dir, "out.mp4")
  const ok = await run([
    "-y",
    "-i", videoUrl,
    "-i", audioUrl,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "160k",
    "-shortest",
    "-movflags", "+faststart",
    file,
  ])
  if (ok === null || !(await stat(file).catch(() => null))?.size) {
    await cleanup()
    return null
  }
  return { file, cleanup }
}

/** `count` small JPEG stills spread across a video, as data URLs (for the AI
    prompt writer: about 15-25 KB each at 320px). Null when ffmpeg is missing. */
export async function stillFrames(
  videoUrl: string,
  seconds: number,
  count = 6
): Promise<string[] | null> {
  const span = Math.max(seconds, 0.5)
  const frames: string[] = []
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5) * span) / count
    const jpeg = await run(
      [
        "-ss", at.toFixed(2),
        "-i", videoUrl,
        "-frames:v", "1",
        "-vf", "scale=320:-2",
        "-q:v", "6",
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "pipe:1",
      ],
      true
    )
    if (jpeg === null) return frames.length ? frames : null
    if (jpeg.length) frames.push(`data:image/jpeg;base64,${jpeg.toString("base64")}`)
  }
  return frames
}
