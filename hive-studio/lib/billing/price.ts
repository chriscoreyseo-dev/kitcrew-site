/** Pure pricing, shared by the Generate button and submitGeneration. The
    server never trusts a client price; it recomputes with the same function.

      credits = ceil(hfUsd × CREDIT_MARKUP / CREDIT_USD_VALUE)

    A rule describes what Higgsfield charges us (USD) for one run. Rules come
    from lib/billing/pricing-table.ts, overridable per model in the
    `model_pricing` collection. A model with no rule is unpriced and can't be
    sold in production. */

import type { MediaRole } from "@/generation/catalog/types"

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
    /** Billed on the length of an INPUT video the member attached (S611, Genjutsu):
        whole seconds, rounded up, clamped to [minSeconds, maxSeconds]. Unpriceable
        (null quote) until that length is known; the server measures it itself. */
    | {
        kind: "per_input_second"
        usd: number
        role: MediaRole
        minSeconds: number
        maxSeconds: number
      }
  /** Multiply the base by setting value, e.g. { resolution: { "1080p": 1.5 } }. */
  multipliers?: Record<string, Record<string, number>>
}

export type PriceConfig = { markup: number; creditUsdValue: number }

/** What a rule can't read from settings: the measured length (seconds) of the
    input video for a per_input_second rule. */
export type PriceInputs = { inputSeconds?: number }

export type Quote = { credits: number; usd: number }

export function hfUsdFor(
  rule: PriceRule,
  settings: Record<string, unknown>,
  inputs: PriceInputs = {}
): number {
  const { base } = rule
  let usd: number
  if (base.kind === "per_run") usd = base.usd
  else if (base.kind === "per_image") {
    const raw = base.countSetting ? settings[base.countSetting] : undefined
    const count = typeof raw === "number" && raw >= 1 ? Math.floor(raw) : 1
    usd = base.usd * count
  } else if (base.kind === "per_input_second") {
    const raw = inputs.inputSeconds
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return NaN
    const seconds = Math.min(
      base.maxSeconds,
      Math.max(base.minSeconds, Math.ceil(raw))
    )
    usd = base.usd * seconds
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
  config: PriceConfig,
  inputs: PriceInputs = {}
): Quote | null {
  if (!rule) return null
  const usd = hfUsdFor(rule, settings, inputs)
  if (!Number.isFinite(usd) || usd < 0) return null
  // Round the product first so float noise (0.1 × 1.5 / 0.01 = 15.000000000000002)
  // never adds a credit.
  const credits = Math.ceil(
    Number(((usd * config.markup) / config.creditUsdValue).toFixed(6))
  )
  return { credits, usd }
}

/** The inputs a rule needs, from what the browser knows: the attached video's
    length for a per_input_second rule (display only - the server re-measures).
    `fromCheapest` quotes the shortest billable video, for "from" prices. */
export function priceInputsFor(
  rule: PriceRule | null | undefined,
  media: { role: MediaRole; url: string }[],
  secondsByUrl: Record<string, number>,
  fromCheapest = false
): PriceInputs {
  const base = rule?.base
  if (base?.kind !== "per_input_second") return {}
  if (fromCheapest) return { inputSeconds: base.minSeconds }
  const url = media.find((m) => m.role === base.role)?.url
  const seconds = url ? secondsByUrl[url] : undefined
  return seconds === undefined ? {} : { inputSeconds: seconds }
}
