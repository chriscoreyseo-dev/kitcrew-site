import { describe, expect, it } from "vitest"

import { MODELS } from "@/generation/catalog"
import { parseSettings } from "@/generation/catalog/parse-settings"
import { priceFor, priceInputsFor } from "@/lib/billing/price"
import type { PriceRule } from "@/lib/billing/price"
import { PRICING_TABLE } from "@/lib/billing/pricing-table"
import {
  PLANS,
  TOPUPS,
  planForPriceId,
  topupCredits,
} from "@/lib/billing/plans"

const cfg = { markup: 1.5, creditUsdValue: 0.01 }

describe("priceFor", () => {
  it("credits = ceil(usd × markup / creditUsdValue)", () => {
    expect(priceFor({ base: { kind: "per_run", usd: 0.1 } }, {}, cfg)).toEqual({
      credits: 15,
      usd: 0.1,
    })
    expect(
      priceFor({ base: { kind: "per_run", usd: 0.101 } }, {}, cfg)?.credits
    ).toBe(16)
  })

  it("prices video per second with resolution multipliers", () => {
    const rule: PriceRule = {
      base: { kind: "per_second", usd: 0.05, defaultSeconds: 5 },
      multipliers: { resolution: { "1080p": 2 } },
    }
    expect(
      priceFor(rule, { duration: 10, resolution: "720p" }, cfg)?.credits
    ).toBe(75)
    expect(
      priceFor(rule, { duration: 10, resolution: "1080p" }, cfg)?.credits
    ).toBe(150)
    expect(priceFor(rule, {}, cfg)?.credits).toBe(38)
  })

  it("is null for unpriced models", () => {
    expect(priceFor(null, {}, cfg)).toBeNull()
  })

  it("client credit-unit rules give exactly the server's credits (markup hidden)", () => {
    const rule: PriceRule = {
      base: { kind: "per_second", usd: 0.07, defaultSeconds: 5 },
      multipliers: { resolution: { "1080p": 1.37 } },
    }
    const scaled: PriceRule = {
      ...rule,
      base: {
        ...rule.base,
        usd: (rule.base.usd * cfg.markup) / cfg.creditUsdValue,
      },
    }
    for (const duration of [3, 4, 5, 7, 10, 13, 15])
      for (const resolution of ["720p", "1080p"])
        expect(
          priceFor(
            scaled,
            { duration, resolution },
            { markup: 1, creditUsdValue: 1 }
          )?.credits
        ).toBe(priceFor(rule, { duration, resolution }, cfg)?.credits)
  })

  it("has a pricing entry for every installed model", () => {
    expect(Object.keys(PRICING_TABLE).sort()).toEqual(
      MODELS.map((m) => m.id).sort()
    )
  })

  it("every priced model quotes a real price at its defaults and every resolution it offers", () => {
    for (const model of MODELS) {
      const rule = PRICING_TABLE[model.id]
      if (!rule) continue
      const defaults = parseSettings(model, {})
      const res = model.settings.resolution
      const tiers = res && res.type === "enum" ? res.values : [undefined]
      for (const resolution of tiers) {
        const settings = resolution ? { ...defaults, resolution } : defaults
        const label = `${model.id} ${resolution ?? ""}`
        // Input-video models (S611) quote at their shortest billable video.
        const quote = priceFor(rule, settings, cfg, priceInputsFor(rule, [], {}, true))
        expect(quote, label).not.toBeNull()
        expect(quote!.usd, label).toBeGreaterThan(0)
        expect(quote!.usd, label).toBeLessThan(25)
      }
    }
  })
})

describe("plans", () => {
  it("maps env price ids back to plans and never trusts unset ones", () => {
    const env = { STRIPE_PRICE_PLUS_ANNUAL: "price_plus_y" }
    expect(planForPriceId("price_plus_y", env)).toMatchObject({
      plan: { id: "plus" },
      interval: "annual",
    })
    expect(planForPriceId("price_unknown", env)).toBeNull()
  })

  it("top-up credits come from config, scaled by plan bonus; TBD stays null", () => {
    expect(topupCredits(TOPUPS.small, PLANS.ultra)).toBeNull()
    expect(
      topupCredits(
        { ...TOPUPS.small, credits: 1000 },
        { ...PLANS.ultra, topupBonus: 1.2 }
      )
    ).toBe(1200)
  })
})
