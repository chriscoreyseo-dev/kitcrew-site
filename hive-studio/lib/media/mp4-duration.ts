/** Length of an MP4/MOV in seconds, read from its `moov`/`mvhd` header with
    HTTP range requests - never the whole file (S611, Genjutsu is billed on the
    input video's seconds and the server never trusts a length from the browser).

    Walks the top-level boxes (ftyp, free, mdat, moov ...) by their sizes, so a
    file whose `moov` sits after a large `mdat` costs a few tiny requests, not a
    download. Returns null when the file isn't a readable MP4. Pure apart from
    the injected `fetchRange`, so it is unit-tested with a fake. */

export type RangeFetch = (
  url: string,
  start: number,
  end: number
) => Promise<Uint8Array | null>

const MAX_TOP_LEVEL_BOXES = 64
const MAX_MOOV_CHILDREN = 64

function u32(b: Uint8Array, at: number): number {
  return ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!
}

function u64(b: Uint8Array, at: number): number {
  return u32(b, at) * 2 ** 32 + u32(b, at + 4)
}

function type(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!)
}

type Box = { type: string; size: number; header: number }

async function readBox(
  fetchRange: RangeFetch,
  url: string,
  offset: number
): Promise<Box | null> {
  const head = await fetchRange(url, offset, offset + 15)
  if (!head || head.length < 8) return null
  let size = u32(head, 0)
  let header = 8
  if (size === 1) {
    if (head.length < 16) return null
    size = u64(head, 8)
    header = 16
  }
  // size 0 = "runs to end of file": only meaningful for the last box.
  return { type: type(head, 4), size, header }
}

/** mvhd body: version(1) flags(3) then times, timescale, duration. */
function mvhdSeconds(body: Uint8Array): number | null {
  if (body.length < 20) return null
  const version = body[0]
  const timescale = version === 1 ? u32(body, 20) : u32(body, 12)
  const duration =
    version === 1
      ? body.length >= 32
        ? u64(body, 24)
        : NaN
      : u32(body, 16)
  if (!timescale || !Number.isFinite(duration) || duration <= 0) return null
  return duration / timescale
}

export async function mp4DurationSeconds(
  url: string,
  fetchRange: RangeFetch = httpRange
): Promise<number | null> {
  let offset = 0
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
    const box = await readBox(fetchRange, url, offset)
    if (!box) return null
    if (box.type === "moov") {
      const end = box.size === 0 ? Infinity : offset + box.size
      let child = offset + box.header
      for (let j = 0; j < MAX_MOOV_CHILDREN && child < end; j++) {
        const c = await readBox(fetchRange, url, child)
        if (!c || c.size < c.header) return null
        if (c.type === "mvhd") {
          const body = await fetchRange(
            url,
            child + c.header,
            child + c.header + 31
          )
          return body ? mvhdSeconds(body) : null
        }
        child += c.size
      }
      return null
    }
    if (box.size === 0 || box.size < box.header) return null
    offset += box.size
  }
  return null
}

const RANGE_TIMEOUT_MS = 8000
/** A server that ignores Range sends the whole file; read at most this much. */
const MAX_UNRANGED_BYTES = 8 * 1024 * 1024

async function httpRange(
  url: string,
  start: number,
  end: number
): Promise<Uint8Array | null> {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal: AbortSignal.timeout(RANGE_TIMEOUT_MS),
  })
  if (response.status === 206)
    return new Uint8Array(await response.arrayBuffer())
  if (response.status !== 200 || !response.body || end >= MAX_UNRANGED_BYTES) {
    await response.body?.cancel()
    return null
  }
  // Range ignored: stream just far enough, then stop.
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let have = 0
  while (have <= end) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    have += value.length
  }
  await reader.cancel()
  const all = new Uint8Array(have)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.length
  }
  return all.slice(start, end + 1)
}
