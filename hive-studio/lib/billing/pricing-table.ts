import type { PriceRule } from "./price"

/** What Higgsfield charges us per run, by model, in USD. Override live via
    `model_pricing`. `null` = unpriced: the model shows "price pending" and
    production refuses to sell it.

    Source: open.higgsfield.ai model pages, read 2026-10-17/18 (S577, S580).
    Rules:
    - LIST (standard) price, never a promo. Most pages show a time-limited
      discount (30-75% off); we price at the stated standard rate so a promo
      ending can never put a run below cost.
    - Base = the model's DEFAULT setting; multipliers cover the other tiers.
    - Where a price depends on a boolean (Kling sound on/off) the rule can't
      see it (price.ts only reads string/number settings), so we take the
      higher rate.
    - A tier we offer that Higgsfield lists no price for is priced at the
      nearest listed tier ABOVE it when one exists, else the top listed tier.

    Still null, and why:
    - soul-cinema, flux-2, flux-3, dop, seedance-2-fast, seedance-2-mini: no
      price page at our REST path (404).
    - seedance-2.5-edit/-extend, kling-3-motion-std/-pro: billed on the INPUT
      video's seconds, which the price function can't see.

    Shape examples:
      { base: { kind: "per_image", usd: 0.02 } }
      { base: { kind: "per_second", usd: 0.08, defaultSeconds: 5 },
        multipliers: { resolution: { "1080p": 1.5 } } }
*/
export const PRICING_TABLE: Record<string, PriceRule | null> = {
  // $0.0032/image at 720p, $0.0057 at 1080p; batch of 4 = 4 images.
  "soul-2": {
    base: { kind: "per_image", usd: 0.0032 },
    multipliers: {
      resolution: { "1080p": 0.0057 / 0.0032 },
      batchSize: { "4": 4 },
    },
  },
  "soul-cinema": null,

  // Billed per video token: $0.0214/1k at 480p/720p (16:9).
  // List: 480p $0.2056/s, 720p $0.4622/s.
  "seedance-2.5": {
    base: { kind: "per_second", usd: 0.4622, defaultSeconds: 5 },
    multipliers: { resolution: { "480p": 0.2056 / 0.4622 } },
  },
  "seedance-2.5-edit": null,
  "seedance-2.5-extend": null,
  // Token rate $0.014/1k (480p-1080p), $0.008/1k at 4K. 480p list $0.141/s
  // (pricing index); 720p $0.3024, 1080p $0.6804, 4K $1.5552 from the
  // token formula (4K checks against the page's 30%-off $1.0887).
  "seedance-2": {
    base: { kind: "per_second", usd: 0.3024, defaultSeconds: 5 },
    multipliers: {
      resolution: {
        "480p": 0.141 / 0.3024,
        "1080p": 0.6804 / 0.3024,
        "4k": 1.5552 / 0.3024,
      },
    },
  },
  "seedance-2-fast": null,
  "seedance-2-mini": null,

  // Kling 3.0. Standard rates: Turbo 720p $0.112, 1080p $0.14. Std/Pro list
  // two rates (1.5x apart, consistent with sound off/on); sound defaults on
  // and the rule can't read it, so we take the higher one.
  "kling-3-turbo": {
    base: { kind: "per_second", usd: 0.112, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.14 / 0.112 } },
  },
  "kling-3-std": {
    base: { kind: "per_second", usd: 0.126, defaultSeconds: 5 },
  },
  "kling-3-pro": {
    base: { kind: "per_second", usd: 0.168, defaultSeconds: 5 },
  },
  "kling-3-4k": {
    base: { kind: "per_second", usd: 0.42, defaultSeconds: 5 },
  },
  "kling-3-motion-std": null,
  "kling-3-motion-pro": null,

  "flux-2": null,
  // $0.04 at 1k, $0.08 at 2k. No 4k price listed.
  "grok-imagine-2": {
    base: { kind: "per_image", usd: 0.04 },
    multipliers: { resolution: { "2k": 2, "4k": 2 } },
  },
  // $0.03 per image, one tier.
  "ideogram-4": { base: { kind: "per_image", usd: 0.03 } },
  // $0.035 at 1k, the only tier listed for this path.
  "recraft-4.1": { base: { kind: "per_image", usd: 0.035 } },
  // $0.04 at 1k, $0.075 at 2k. No 4k price listed.
  "qwen-image-3": {
    base: { kind: "per_image", usd: 0.04 },
    multipliers: { resolution: { "2k": 0.075 / 0.04, "4k": 0.075 / 0.04 } },
  },
  // $0.015 at 1k and 2k.
  "z-image-turbo": { base: { kind: "per_image", usd: 0.015 } },

  // Wan 3.0: 720p $0.10, 1080p $0.20.
  "wan-3": {
    base: { kind: "per_second", usd: 0.1, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 2 } },
  },
  // Page states only the 60%-off promo ($0.056 720p, $0.112 1080p); list
  // derived /0.4 = $0.14, $0.28 (the index's $0.068 "from" matches 480p).
  "wan-3-prime": {
    base: { kind: "per_second", usd: 0.14, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 2 } },
  },
  // Wan 2.7 and 2.6: 720p $0.10, 1080p $0.15.
  "wan-2.7": {
    base: { kind: "per_second", usd: 0.1, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 1.5 } },
  },
  "wan-2.6": {
    base: { kind: "per_second", usd: 0.1, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 1.5 } },
  },
  "flux-3": null,
  // MiniMax H3: $0.13/s, one tier (2K).
  "minimax-h3": {
    base: { kind: "per_second", usd: 0.13, defaultSeconds: 5 },
  },
  // Hailuo 2.3: $0.0467/s on 6s clips, $0.056/s on 10s; take the higher.
  "minimax-hailuo-2.3": {
    base: { kind: "per_second", usd: 0.056, defaultSeconds: 5 },
  },
  // Happy Horse 1.0: 720p $0.14, 1080p $0.28. 1.1: 720p $0.14, 1080p $0.18.
  "happy-horse-1": {
    base: { kind: "per_second", usd: 0.14, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 2 } },
  },
  "happy-horse-1.1": {
    base: { kind: "per_second", usd: 0.14, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.18 / 0.14 } },
  },
  // Older Kling: each lists two rates; take the higher (no tier setting).
  // 2.6 $0.07/$0.14, O3 and O1 $0.084/$0.112. 2.5 Turbo: $0.042, one rate.
  "kling-2.6": {
    base: { kind: "per_second", usd: 0.14, defaultSeconds: 5 },
  },
  "kling-2.5": {
    base: { kind: "per_second", usd: 0.042, defaultSeconds: 5 },
  },
  "kling-o3": {
    base: { kind: "per_second", usd: 0.112, defaultSeconds: 5 },
  },
  "kling-o1": {
    base: { kind: "per_second", usd: 0.112, defaultSeconds: 5 },
  },
  // LTX 2.5 (no discount shown): Fast 720p $0.09, 1080p $0.13;
  // Pro 720p $0.12, 1080p $0.17.
  "ltx-2.5-fast": {
    base: { kind: "per_second", usd: 0.09, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.13 / 0.09 } },
  },
  "ltx-2.5-pro": {
    base: { kind: "per_second", usd: 0.12, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.17 / 0.12 } },
  },
  // Grok Imagine Video 1.5 (no discount shown): 720p $0.14, 1080p $0.25.
  "grok-imagine-video-1.5": {
    base: { kind: "per_second", usd: 0.14, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.25 / 0.14 } },
  },
  // PixVerse 6 standard: 720p $0.06, 1080p $0.115.
  "pixverse-6": {
    base: { kind: "per_second", usd: 0.06, defaultSeconds: 5 },
    multipliers: { resolution: { "1080p": 0.115 / 0.06 } },
  },
  dop: null,
}
