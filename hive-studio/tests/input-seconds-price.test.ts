import { describe, expect, it } from "vitest"

import { priceFor, priceInputsFor } from "@/lib/billing/price"
import type { PriceRule } from "@/lib/billing/price"
import { mp4DurationSeconds } from "@/lib/media/mp4-duration"

/** S611: models billed on the INPUT video's seconds (Genjutsu). */

const RULE: PriceRule = {
  base: {
    kind: "per_input_second",
    usd: 0.5,
    role: "video",
    minSeconds: 4,
    maxSeconds: 30,
  },
  multipliers: { resolution: { "1080p": 2 } },
}
const ONE_TO_ONE = { markup: 1, creditUsdValue: 0.01 }

describe("per_input_second pricing", () => {
  it("has no price until the video's length is known", () => {
    expect(priceFor(RULE, {}, ONE_TO_ONE)).toBeNull()
    expect(priceFor(RULE, {}, ONE_TO_ONE, { inputSeconds: 0 })).toBeNull()
  })

  it("bills whole seconds, rounded up", () => {
    expect(priceFor(RULE, {}, ONE_TO_ONE, { inputSeconds: 10 })).toEqual({ credits: 500, usd: 5 })
    expect(priceFor(RULE, {}, ONE_TO_ONE, { inputSeconds: 10.2 })?.usd).toBe(5.5)
  })

  it("clamps to the platform's 4-30s window", () => {
    expect(priceFor(RULE, {}, ONE_TO_ONE, { inputSeconds: 2 })?.usd).toBe(2)
    expect(priceFor(RULE, {}, ONE_TO_ONE, { inputSeconds: 95 })?.usd).toBe(15)
  })

  it("still applies setting multipliers", () => {
    expect(
      priceFor(RULE, { resolution: "1080p" }, ONE_TO_ONE, { inputSeconds: 10 })?.usd
    ).toBe(10)
  })

  it("browser inputs come from the attached video, 'from' prices from the shortest", () => {
    const media = [{ role: "video" as const, url: "https://in.test/v" }]
    expect(priceInputsFor(RULE, media, { "https://in.test/v": 12 })).toEqual({ inputSeconds: 12 })
    expect(priceInputsFor(RULE, media, {})).toEqual({})
    expect(priceInputsFor(RULE, [], {}, true)).toEqual({ inputSeconds: 4 })
    expect(priceInputsFor({ base: { kind: "per_run", usd: 1 } }, media, { "https://in.test/v": 12 })).toEqual({})
  })
})

// ------------------------------------------------------------ MP4 reader

function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length)
  new DataView(out.buffer).setUint32(0, out.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(body, 8)
  return out
}
function mvhd(version: 0 | 1, timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(version === 1 ? 108 : 96)
  const v = new DataView(body.buffer)
  body[0] = version
  if (version === 1) {
    v.setUint32(20, timescale)
    v.setUint32(24, Math.floor(duration / 2 ** 32))
    v.setUint32(28, duration % 2 ** 32)
  } else {
    v.setUint32(12, timescale)
    v.setUint32(16, duration)
  }
  return box("mvhd", body)
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
function fakeFetch(file: Uint8Array) {
  const calls: number[] = []
  const fetchRange = async (_url: string, start: number, end: number) => {
    calls.push(end - start + 1)
    return start >= file.length ? null : file.slice(start, end + 1)
  }
  return { fetchRange, calls }
}

describe("mp4DurationSeconds", () => {
  const ftyp = box("ftyp", new Uint8Array(16))

  it("reads a moov at the front (fast-start file)", async () => {
    const file = concat(ftyp, box("moov", concat(mvhd(0, 1000, 12_500), box("trak", new Uint8Array(40)))), box("mdat", new Uint8Array(500)))
    expect(await mp4DurationSeconds("u", fakeFetch(file).fetchRange)).toBe(12.5)
  })

  it("skips a large mdat to reach a moov at the end, without reading it", async () => {
    const file = concat(ftyp, box("mdat", new Uint8Array(200_000)), box("moov", mvhd(0, 600, 4_800)))
    const { fetchRange, calls } = fakeFetch(file)
    expect(await mp4DurationSeconds("u", fetchRange)).toBe(8)
    expect(Math.max(...calls)).toBeLessThanOrEqual(32)
  })

  it("reads a version-1 mvhd (64-bit duration)", async () => {
    const file = concat(ftyp, box("moov", mvhd(1, 90_000, 2_700_000)))
    expect(await mp4DurationSeconds("u", fakeFetch(file).fetchRange)).toBe(30)
  })

  it("returns null for something that isn't an MP4", async () => {
    expect(await mp4DurationSeconds("u", fakeFetch(new TextEncoder().encode("<html>not a video</html>")).fetchRange)).toBeNull()
    expect(await mp4DurationSeconds("u", fakeFetch(new Uint8Array(4)).fetchRange)).toBeNull()
  })
})

describe("a model's own markup (S611: Genjutsu at cost + 30%)", () => {
  it("replaces the global markup for that model only", () => {
    const withOwn: PriceRule = { ...RULE, markup: 1.3 }
    // 10s at $0.50/s = $5 cost; global 1.5 -> 750 cents, own 1.3 -> 650 cents.
    expect(priceFor(RULE, {}, { markup: 1.5, creditUsdValue: 0.01 }, { inputSeconds: 10 })?.credits).toBe(750)
    expect(priceFor(withOwn, {}, { markup: 1.5, creditUsdValue: 0.01 }, { inputSeconds: 10 })?.credits).toBe(650)
  })
})
