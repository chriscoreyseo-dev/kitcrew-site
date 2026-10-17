/** Pure pricing, shared by the Generate button and submitGeneration. The
    server never trusts a client price; it recomputes with the same function.

      credits = ceil(hfUsd × CREDIT_MARKUP / CREDIT_USD_VALUE)

    A rule describes what Higgsfield charges us (USD) for one run. Rules come
    from lib/billing/pricing-table.ts, overridable per model in the
    `model_pricing` collection. A model with no rule is unpriced and can't be
    sold in production. */

export type PriceRule = {
  base:
    | { kind: "per_run"; usd: number }
    | { kind: "per_image"; usd: number; countSetting?: string }
    | {
        kind: "per_second"
        usd: number
        durationSetting?: string
        defaultSeconds: number
      }
  /** Multiply the base by setting value, e.g. { resolution: { "1080p": 1.5 } }. */
  multipliers?: Record<string, Record<string, number>>
}

export type PriceConfig = { markup: number; creditUsdValue: number }

export type Quote = { credits: number; usd: number }

export function hfUsdFor(
  rule: PriceRule,
  settings: Record<string, unknown>
): number {
  const { base } = rule
  let usd: number
  if (base.kind === "per_run") usd = base.usd
  else if (base.kind === "per_image") {
    const raw = base.countSetting ? settings[base.countSetting] : undefined
    const count = typeof raw === "number" && raw >= 1 ? Math.floor(raw) : 1
    usd = base.usd * count
  } else {
    const raw = settings[base.durationSetting ?? "duration"]
    const seconds =
      typeof raw === "number" && raw > 0 ? raw : base.defaultSeconds
    usd = base.usd * seconds
  }
  for (const [setting, table] of Object.entries(rule.multipliers ?? {})) {
    const value = settings[setting]
    const factor =
      typeof value === "string" || typeof value === "number"
        ? table[String(value)]
        : undefined
    if (factor !== undefined) usd *= factor
  }
  return usd
}

/** Credits for one run, or null when the model has no price yet. */
export function priceFor(
  rule: PriceRule | null | undefined,
  settings: Record<string, unknown>,
  config: PriceConfig
): Quote | null {
  if (!rule) return null
  const usd = hfUsdFor(rule, settings)
  if (!Number.isFinite(usd) || usd < 0) return null
  // Round the product first so float noise (0.1 × 1.5 / 0.01 = 15.000000000000002)
  // never adds a credit.
  const credits = Math.ceil(
    Number(((usd * config.markup) / config.creditUsdValue).toFixed(6))
  )
  return { credits, usd }
}
