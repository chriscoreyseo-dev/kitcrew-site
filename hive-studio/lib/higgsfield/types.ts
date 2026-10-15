/** Platform response shapes. Type-only, safe to import from client code. */

export type QueuedGeneration = {
  status: string
  requestId: string
  statusUrl: string
  cancelUrl: string
}

export type GenerationStatus = {
  status: string
  requestId: string
  images?: Array<{ url: string }>
  video?: { url: string }
  error?: unknown
}

/** One request's answer inside a batched status poll. A request that errors
    carries its reason alone, so it cannot lose the answers standing beside it. */
export type StatusResult =
  | { requestId: string; status: GenerationStatus }
  | { requestId: string; error: string }
