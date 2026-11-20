/** Platform response shapes. Type-only, safe to import from client code. */

export type QueuedGeneration = {
  status: string
  requestId: string
  statusUrl: string
  cancelUrl: string
}

export type PlatformStatus =
  "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled"

export type GenerationStatus = {
  /** One of PlatformStatus; kept as string so an unknown value is visible, not dropped. */
  status: string
  requestId: string
  images?: Array<{ url: string }>
  video?: { url: string }
  /** Audio models (shape unverified against docs; see decisions D-026). */
  audio?: { url: string }
  error?: unknown
}

export type OutputKind = "image" | "video" | "audio"

/** One batched status answer. A request that errors carries its reason alone. */
export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string }

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "failed",
  "nsfw",
  "canceled",
])

/** Every media URL in a status payload, in display order. */
export function outputsOf(
  status: GenerationStatus
): Array<{ kind: OutputKind; url: string }> {
  return [
    ...(status.images ?? []).map((i) => ({
      kind: "image" as const,
      url: i.url,
    })),
    ...(status.video
      ? [{ kind: "video" as const, url: status.video.url }]
      : []),
    ...(status.audio
      ? [{ kind: "audio" as const, url: status.audio.url }]
      : []),
  ]
}
