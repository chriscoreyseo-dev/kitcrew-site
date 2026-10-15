import "server-only"

import {
  parseUploadTicket,
  requireUploadContentType,
} from "@/generation/upload-contract"
import type { UploadTicket } from "@/generation/upload-contract"

import { toAuthorizationHeader } from "./credentials"
import type { GenerationStatus, QueuedGeneration } from "./types"

export type { GenerationStatus, QueuedGeneration, StatusResult } from "./types"

const UPLOAD_PATH = "/files/generate-upload-url"
const MODEL_ID = /^[a-z0-9][a-z0-9._/-]*$/i

export class PlatformError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(messageFromBody(status, body))
    this.name = "PlatformError"
    this.status = status
    this.body = body
  }
}

/** The request never produced an HTTP answer (timeout, reset). For a submit
    this is the "unclear" case: the job may or may not exist. */
export class PlatformUnreachableError extends Error {
  constructor(
    readonly sent: boolean,
    cause: unknown
  ) {
    super("Higgsfield did not answer", { cause })
    this.name = "PlatformUnreachableError"
  }
}

export type RetryPolicy = {
  retries: number
  baseMs: number
  maxMs: number
  /** Retry on this HTTP status? */
  status: (code: number) => boolean
  /** Retry when no response arrived? `sent` is false only when the connection
      failed before the request could reach the server. */
  network: (sent: boolean) => boolean
}

/** Status/cancel/upload: safe to repeat. */
const READ_RETRY: RetryPolicy = {
  retries: 3,
  baseMs: 500,
  maxMs: 8000,
  status: (code) => code === 429 || code >= 500,
  network: () => true,
}

/** Submit creates a job. Repeat only when the platform certainly did not
    accept it: 429, 503, or a connection that never opened. An ambiguous 500,
    502, 504 or a timeout is NOT retried (it could double-create the job);
    the generation stays pending_submit and the reconciler resolves it. */
const SUBMIT_RETRY: RetryPolicy = {
  retries: 3,
  baseMs: 1000,
  maxMs: 15000,
  status: (code) => code === 429 || code === 503,
  network: (sent) => !sent,
}

export type PlatformClientOptions = {
  apiKey: string
  baseUrl: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export function isModelId(model: string): boolean {
  return MODEL_ID.test(model) && !model.includes("..")
}

/** Full jitter: uniform in [0, min(max, base * 2^attempt)]; honors Retry-After. */
export function backoffMs(
  policy: RetryPolicy,
  attempt: number,
  random: () => number,
  retryAfterSec?: number
): number {
  if (retryAfterSec !== undefined && retryAfterSec >= 0)
    return Math.min(policy.maxMs, retryAfterSec * 1000)
  return Math.floor(
    random() * Math.min(policy.maxMs, policy.baseMs * 2 ** attempt)
  )
}

const CONNECT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"])

function wasSent(error: unknown): boolean {
  const code = (error as { cause?: { code?: unknown } })?.cause?.code
  return !(typeof code === "string" && CONNECT_CODES.has(code))
}

export function createPlatformClient(options: PlatformClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? fetch
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const random = options.random ?? Math.random
  const auth = toAuthorizationHeader(options.apiKey)

  async function send(
    method: "GET" | "POST",
    path: string,
    policy: RetryPolicy,
    timeoutMs: number,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    // Log the route only: query strings carry webhook tokens, bodies carry
    // prompts, and upload responses carry signed URLs.
    const route = path.split("?")[0]
    for (let attempt = 0; ; attempt += 1) {
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: {
            Authorization: auth,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        const sent = wasSent(error)
        if (attempt < policy.retries && policy.network(sent)) {
          await sleep(backoffMs(policy, attempt, random))
          continue
        }
        console.warn("[higgsfield] no response", { method, route, sent })
        throw new PlatformUnreachableError(sent, error)
      }
      const payload = await readJson(response)
      if (response.ok) return payload
      if (attempt < policy.retries && policy.status(response.status)) {
        const retryAfter = Number(response.headers.get("retry-after"))
        await sleep(
          backoffMs(
            policy,
            attempt,
            random,
            Number.isFinite(retryAfter) ? retryAfter : undefined
          )
        )
        continue
      }
      console.warn("[higgsfield] error", {
        method,
        route,
        status: response.status,
      })
      throw new PlatformError(response.status, payload)
    }
  }

  return {
    async createUpload(contentType: unknown): Promise<UploadTicket> {
      const type = requireUploadContentType(contentType)
      return parseUploadTicket(
        await send("POST", UPLOAD_PATH, READ_RETRY, 15_000, {
          content_type: type,
        }),
        type
      )
    },
    /** `webhookUrl` is appended as `hf_webhook` (docs: how-to/webhooks). */
    async submit(
      model: string,
      input: Record<string, unknown>,
      webhookUrl?: string
    ): Promise<QueuedGeneration> {
      if (!isModelId(model))
        throw new PlatformError(400, { detail: "Invalid model" })
      const query = webhookUrl
        ? `?hf_webhook=${encodeURIComponent(webhookUrl)}`
        : ""
      return mapQueued(
        await send("POST", `/${model}${query}`, SUBMIT_RETRY, 30_000, input)
      )
    },
    async status(requestId: string): Promise<GenerationStatus> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      return mapStatus(
        await send(
          "GET",
          `/requests/${encodeURIComponent(requestId)}/status`,
          READ_RETRY,
          10_000
        )
      )
    },
    /** Queued requests only: 202 when canceled, 400 once it has started. */
    async cancel(requestId: string): Promise<void> {
      if (!requestId)
        throw new PlatformError(400, { detail: "Missing request id" })
      await send(
        "POST",
        `/requests/${encodeURIComponent(requestId)}/cancel`,
        { ...READ_RETRY, status: (code) => code === 429 || code >= 500 },
        10_000,
        {}
      )
    },
  }
}

export type PlatformClient = ReturnType<typeof createPlatformClient>

function mapQueued(payload: unknown): QueuedGeneration {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id")
  if (!requestId)
    throw new PlatformError(502, {
      detail: "Platform response missing request_id",
    })
  return {
    status: stringField(data, "status") ?? "queued",
    requestId,
    statusUrl: stringField(data, "status_url") ?? "",
    cancelUrl: stringField(data, "cancel_url") ?? "",
  }
}

export function mapStatus(payload: unknown): GenerationStatus {
  const data = asRecord(payload)
  const requestId = stringField(data, "request_id") ?? ""
  const images = Array.isArray(data.images)
    ? data.images.flatMap((item) => {
        const url = asRecord(item).url
        return typeof url === "string" ? [{ url }] : []
      })
    : undefined
  const videoUrl = asRecord(data.video).url
  const audioUrl = asRecord(data.audio).url

  return {
    status: stringField(data, "status") ?? "unknown",
    requestId,
    ...(images?.length ? { images } : {}),
    ...(typeof videoUrl === "string" ? { video: { url: videoUrl } } : {}),
    ...(typeof audioUrl === "string" ? { audio: { url: audioUrl } } : {}),
    ...(data.error !== undefined && data.error !== null
      ? { error: data.error }
      : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key]
  return typeof field === "string" ? field : undefined
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function messageFromBody(status: number, body: unknown): string {
  const detail = asRecord(body).detail
  if (typeof detail === "string" && detail) return detail
  return `Platform request failed (${status})`
}
