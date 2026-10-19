import "server-only"

import type { Surface } from "@/generation/catalog/types"
import { requireEnv } from "@/lib/env"

import { signWallet } from "./signing"

/** MarketHive is the wallet of record in markethive mode (S566-DRL-01, D-057).
    Members pay in Hive credits: MEMBER_DETAILS.VAULT_BALANCE, a dollar
    balance. MarketHive owns the price (ADMIN_PARAMS) and the ledger; the
    studio only asks it to debit or refund a generation by reference.

    Amounts cross the wire as decimal strings in dollars and are held here as
    integer cents, so nothing on our side does float arithmetic on money. */

export type WalletPrices = Record<Surface, number | null>
export type WalletSnapshot = { balance: number; prices: WalletPrices }

export class WalletUnavailableError extends Error {
  constructor(detail: string) {
    super("MarketHive credits are unavailable right now. Try again shortly.")
    this.name = "WalletUnavailableError"
    this.cause = detail
  }
}

/** A definite "no" from MarketHive: nothing was debited. */
export class WalletDeclinedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly balance?: number
  ) {
    super(message)
    this.name = "WalletDeclinedError"
  }
}

type WireOk = {
  ok: true
  balance?: string | number
  charged?: string | number
  refunded?: boolean
  prices?: Partial<Record<Surface, string | number | null>>
  /** feed_post (S584) */
  post_slug?: string
  post_url?: string
  existing?: boolean
}
type WireErr = {
  ok: false
  error?: string
  message?: string
  balance?: string | number
}

export function toCents(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

const SURFACES: Surface[] = ["image", "video", "audio"]

async function call(
  action: "balance" | "prices" | "debit" | "refund" | "feed_post",
  fields: Record<string, string | number>
): Promise<WireOk> {
  const env = requireEnv("markethive")
  const body = JSON.stringify({ action, ...fields })
  const ts = Math.floor(Date.now() / 1000)
  const url = new URL("/hive_studio_api.php", env.MARKETHIVE_BASE_URL)
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hive-studio-ts": String(ts),
        "x-hive-studio-sig": signWallet(env.MARKETHIVE_SHARED_SECRET, ts, body),
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    throw new WalletUnavailableError(`${action}: ${String(error)}`)
  }
  let data: WireOk | WireErr
  try {
    data = (await response.json()) as WireOk | WireErr
  } catch {
    // dev3 answers 200 with an HTML page for unknown paths: never read that as success.
    throw new WalletUnavailableError(
      `${action}: non-JSON reply (${response.status})`
    )
  }
  if (data && data.ok === true) return data
  const err = (data ?? {}) as WireErr
  const code = err.error ?? `http_${response.status}`
  if (
    [
      "insufficient",
      "unpriced",
      "unknown_member",
      "disabled",
      "not_shared",
      "not_owner",
      "unsupported",
    ].includes(code)
  )
    throw new WalletDeclinedError(
      code,
      err.message ?? "MarketHive declined the charge.",
      toCents(err.balance) ?? undefined
    )
  throw new WalletUnavailableError(`${action}: ${code}`)
}

function pricesOf(data: WireOk): WalletPrices {
  return Object.fromEntries(
    SURFACES.map((s) => [s, toCents(data.prices?.[s])])
  ) as WalletPrices
}

export async function walletSnapshot(
  memberId: number
): Promise<WalletSnapshot> {
  const data = await call("balance", { member_id: memberId })
  return { balance: toCents(data.balance) ?? 0, prices: pricesOf(data) }
}

const PRICE_TTL_MS = 30_000
let priceCache: { at: number; value: WalletPrices } | undefined

/** Per-generation prices from MarketHive's ADMIN_PARAMS (null = not priced).
    Display and pre-check only: MarketHive charges its own price at debit. */
export async function walletPrices(now = Date.now()): Promise<WalletPrices> {
  if (priceCache && now - priceCache.at < PRICE_TTL_MS) return priceCache.value
  const value = pricesOf(await call("prices", {}))
  priceCache = { at: now, value }
  return value
}

export function resetWalletPriceCache(): void {
  priceCache = undefined
}

/** Idempotent on `ref` (our generation id): a retry returns the first result. */
export async function walletDebit(input: {
  memberId: number
  ref: string
  surface: Surface
  model: string
  /** The run's price in MarketHive cents: Higgsfield cost x markup (S577-DRL-02). */
  amountCents: number
}): Promise<{ charged: number; balance: number }> {
  const data = await call("debit", {
    member_id: input.memberId,
    ref: input.ref,
    surface: input.surface,
    model: input.model,
    amount: (Math.max(0, Math.round(input.amountCents)) / 100).toFixed(2),
  })
  const charged = toCents(data.charged)
  if (charged === null || charged < 0)
    throw new WalletUnavailableError("debit: no charged amount")
  return { charged, balance: toCents(data.balance) ?? 0 }
}

/** Idempotent: refunds a debited ref once; a ref that was never debited is a no-op. */
export async function walletRefund(input: {
  memberId: number
  ref: string
}): Promise<{ refunded: boolean; balance: number }> {
  const data = await call("refund", {
    member_id: input.memberId,
    ref: input.ref,
  })
  return {
    refunded: data.refunded === true,
    balance: toCents(data.balance) ?? 0,
  }
}

/** S584 (Chris): post the member's shared item to their MarketHive News Feed.
    MarketHive reads the item back from /api/shared/<slug>, checks the member
    owns it, and posts it once (a repeat returns the first post). Friends see
    it; Boost - MarketHive's own, on the post page - makes it public. */
export async function postToNewsfeed(input: {
  memberId: number
  slug: string
  caption?: string
}): Promise<{ postUrl: string; existing: boolean }> {
  const data = await call("feed_post", {
    member_id: input.memberId,
    slug: input.slug,
    caption: (input.caption ?? "").slice(0, 500),
  })
  if (!data.post_url || !/^https:\/\//.test(data.post_url))
    throw new WalletUnavailableError("feed_post: no post URL")
  return { postUrl: data.post_url, existing: data.existing === true }
}
