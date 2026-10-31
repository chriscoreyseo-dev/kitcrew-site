import "server-only"

import type { MediaRole } from "@/generation/catalog/types"
import { db } from "@/lib/db/mongo"
import { env } from "@/lib/env"
import { isMarketHive } from "@/lib/mode"

import { priceFor } from "./price"
import type { PriceInputs, PriceRule, Quote } from "./price"
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

/** Standalone: studio credits at CREDIT_USD_VALUE each, with CREDIT_MARKUP.
    MarketHive mode (S577-DRL-02): the run's real Higgsfield cost x
    MARKETHIVE_MARKUP, in MarketHive cents (MarketHive credits are dollars). */
export function priceConfig() {
  const e = env()
  if (isMarketHive())
    return { markup: e.MARKETHIVE_MARKUP, creditUsdValue: 0.01 }
  return { markup: e.CREDIT_MARKUP, creditUsdValue: e.CREDIT_USD_VALUE }
}

export async function quoteFor(
  modelId: string,
  settings: Record<string, unknown>,
  inputs: PriceInputs = {}
): Promise<{ enabled: boolean; quote: Quote | null }> {
  const entry = (await effectivePricing())[modelId]
  return {
    enabled: entry?.enabled ?? true,
    quote: priceFor(entry?.rule ?? null, settings, priceConfig(), inputs),
  }
}

/** The input a model's price depends on, when its rule bills an input video's
    seconds (S611, Genjutsu): which role, and the shortest length it accepts. */
export async function inputPricedRole(
  modelId: string
): Promise<{ role: MediaRole; minSeconds: number } | null> {
  const base = (await effectivePricing())[modelId]?.rule?.base
  return base?.kind === "per_input_second"
    ? { role: base.role, minSeconds: base.minSeconds }
    : null
}

/** Rules rescaled into credit units so the browser can show exact costs
    without learning our markup or what Higgsfield charges us: priceFor(scaled,
    settings, { markup: 1, creditUsdValue: 1 }) equals the server's credits. */
export async function clientPricing(): Promise<
  Record<string, { rule: PriceRule | null; enabled: boolean }>
> {
  const { markup, creditUsdValue } = priceConfig()
  return Object.fromEntries(
    Object.entries(await effectivePricing()).map(([id, { rule, enabled }]) => {
      if (!rule) return [id, { enabled, rule: null }]
      // A rule's own markup (S611) is folded in here too, so the browser never
      // learns it and its markup-1 quote still equals the server's credits.
      const { markup: own, ...rest } = rule
      const factor = (own ?? markup) / creditUsdValue
      return [
        id,
        { enabled, rule: { ...rest, base: { ...rest.base, usd: rest.base.usd * factor } } },
      ]
    })
  )
}

/** Drop the cached overrides so the next read sees an admin edit at once
    (other server instances pick it up within the TTL). */
export function resetPricingCache(): void {
  cache = undefined
}
