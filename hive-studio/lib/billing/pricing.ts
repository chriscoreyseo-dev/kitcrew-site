import "server-only"

import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"

import { priceFor } from "./price"
import type { PriceRule, Quote } from "./price"
import { PRICING_TABLE } from "./pricing-table"

/** Effective pricing = static table + `model_pricing` overrides (admin-editable).
    `enabled: false` hides a model. Cached briefly; overrides are rare. */

export type ModelPricingDoc = {
  modelId: string
  rule?: PriceRule | null
  enabled?: boolean
  hfUsdSource?: string
}

export type EffectivePricing = Record<
  string,
  { rule: PriceRule | null; enabled: boolean }
>

const TTL_MS = 30_000
let cache: { at: number; value: EffectivePricing } | undefined

export async function effectivePricing(
  now = Date.now()
): Promise<EffectivePricing> {
  if (cache && now - cache.at < TTL_MS) return cache.value
  let overrides: ModelPricingDoc[] = []
  try {
    overrides = await db()
      .collection<ModelPricingDoc>("model_pricing")
      .find({})
      .toArray()
  } catch {
    // No database yet (or a blip): the static table still prices everything.
  }
  const value: EffectivePricing = Object.fromEntries(
    Object.entries(PRICING_TABLE).map(([id, rule]) => [
      id,
      { rule, enabled: true },
    ])
  )
  for (const o of overrides)
    value[o.modelId] = {
      rule: o.rule === undefined ? (value[o.modelId]?.rule ?? null) : o.rule,
      enabled: o.enabled ?? true,
    }
  cache = { at: now, value }
  return value
}

export function priceConfig() {
  const e = env()
  return { markup: e.CREDIT_MARKUP, creditUsdValue: e.CREDIT_USD_VALUE }
}

export async function quoteFor(
  modelId: string,
  settings: Record<string, unknown>
): Promise<{ enabled: boolean; quote: Quote | null }> {
  const entry = (await effectivePricing())[modelId]
  return {
    enabled: entry?.enabled ?? true,
    quote: priceFor(entry?.rule ?? null, settings, priceConfig()),
  }
}

/** Rules rescaled into credit units so the browser can show exact costs
    without learning our markup or what Higgsfield charges us: priceFor(scaled,
    settings, { markup: 1, creditUsdValue: 1 }) equals the server's credits. */
export async function clientPricing(): Promise<
  Record<string, { rule: PriceRule | null; enabled: boolean }>
> {
  const { markup, creditUsdValue } = priceConfig()
  const factor = markup / creditUsdValue
  return Object.fromEntries(
    Object.entries(await effectivePricing()).map(([id, { rule, enabled }]) => [
      id,
      {
        enabled,
        rule: rule
          ? { ...rule, base: { ...rule.base, usd: rule.base.usd * factor } }
          : null,
      },
    ])
  )
}

/** Drop the cached overrides so the next read sees an admin edit at once
    (other server instances pick it up within the TTL). */
export function resetPricingCache(): void {
  cache = undefined
}
