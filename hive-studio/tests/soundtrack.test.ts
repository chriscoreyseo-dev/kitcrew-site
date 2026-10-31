import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vitest"

import { stillFrames, withSoundtrack } from "@/lib/media/ffmpeg"

/** S611: Genjutsu comes back silent; the motion clip's soundtrack is laid back
    on. Uses the machine's ffmpeg and skips where there is none (the Docker
    image installs it). */

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0
const dir = mkdtempSync(path.join(tmpdir(), "hive-soundtrack-test-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function make(name: string, args: string[]) {
  const file = path.join(dir, name)
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args, file])
  if (r.status !== 0) throw new Error(String(r.stderr))
  return file
}

function streams(file: string): string[] {
  const r = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type",
    "-of", "csv=p=0",
    file,
  ])
  return String(r.stdout).trim().split(/\s+/)
}

describe.skipIf(!hasFfmpeg)("withSoundtrack", () => {
  it("puts the clip's audio under the silent result's picture", async () => {
    const silent = make("silent.mp4", [
      "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
    ])
    const clip = make("clip.mp4", [
      "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    ])
    expect(streams(silent)).toEqual(["video"])
    const mixed = await withSoundtrack(silent, clip)
    expect(mixed).not.toBeNull()
    expect(streams(mixed!.file).sort()).toEqual(["audio", "video"])
    await mixed!.cleanup()
  })

  it("returns null when the clip has no audio, so the plain result is kept", async () => {
    const a = make("a.mp4", [
      "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=1",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
    ])
    expect(await withSoundtrack(a, a)).toBeNull()
  })

  it("grabs small JPEG stills as data URLs", async () => {
    const v = make("v.mp4", [
      "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
    ])
    const frames = await stillFrames(v, 2, 3)
    expect(frames).toHaveLength(3)
    for (const f of frames!) expect(f.startsWith("data:image/jpeg;base64,")).toBe(true)
  })
})
