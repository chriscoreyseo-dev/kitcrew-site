import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/** Higgsfield's REST webhooks are unsigned (decisions D-007), so each webhook
    URL carries its own proof: t = HMAC-SHA256(generationId, HF_WEBHOOK_SECRET).
    The payload is never trusted; the handler re-fetches the status. */

export function webhookToken(generationId: string, secret: string): string {
  return createHmac("sha256", secret).update(generationId).digest("hex")
}

export function verifyWebhookToken(
  generationId: string,
  token: string,
  secret: string
): boolean {
  const expected = Buffer.from(webhookToken(generationId, secret), "hex")
  const given = /^[0-9a-f]{64}$/.test(token)
    ? Buffer.from(token, "hex")
    : Buffer.alloc(0)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Undefined when there's no public base URL (local dev: reconcile-only). */
export function webhookUrlFor(
  generationId: string,
  env: { HF_WEBHOOK_BASE_URL?: string; HF_WEBHOOK_SECRET?: string }
): string | undefined {
  if (!env.HF_WEBHOOK_BASE_URL || !env.HF_WEBHOOK_SECRET) return undefined
  const url = new URL("/api/webhooks/higgsfield", env.HF_WEBHOOK_BASE_URL)
  url.searchParams.set("gid", generationId)
  url.searchParams.set("t", webhookToken(generationId, env.HF_WEBHOOK_SECRET))
  return url.toString()
}
