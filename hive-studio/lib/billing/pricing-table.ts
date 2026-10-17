import type { PriceRule } from "./price"

/** What Higgsfield charges us per run, by model. Every value is TBD: the
    per-model USD price list lives in console.higgsfield.ai, which the build
    environment can't reach (decisions D-004/D-039). `null` = unpriced: the
    model shows "price pending" and production refuses to sell it.
    Fill from the console export, then override live via `model_pricing`.

    Shape examples:
      { base: { kind: "per_image", usd: 0.02 } }
      { base: { kind: "per_second", usd: 0.08, defaultSeconds: 5 },
        multipliers: { resolution: { "1080p": 1.5 } } }
*/
export const PRICING_TABLE: Record<string, PriceRule | null> = {
  // Higgsfield API list price, read from open.higgsfield.ai 2026-10-17 (S577):
  // $0.0032/image at 720p, $0.0057 at 1080p; batch of 4 = 4 images.
  "soul-2": {
    base: { kind: "per_image", usd: 0.0032 },
    multipliers: {
      resolution: { "1080p": 0.0057 / 0.0032 },
      batchSize: { "4": 4 },
    },
  },
  "soul-cinema": null,
  "seedance-2.5": null,
  "seedance-2.5-edit": null,
  "seedance-2.5-extend": null,
  "seedance-2": null,
  "seedance-2-fast": null,
  "seedance-2-mini": null,
  "kling-3-turbo": null,
  "kling-3-std": null,
  "kling-3-pro": null,
  "kling-3-4k": null,
  "kling-3-motion-std": null,
  "kling-3-motion-pro": null,
  "flux-2": null,
  "grok-imagine-2": null,
  "ideogram-4": null,
  "recraft-4.1": null,
  "qwen-image-3": null,
  "z-image-turbo": null,
  "wan-3": null,
  "wan-3-prime": null,
  "wan-2.7": null,
  "wan-2.6": null,
  "flux-3": null,
  "minimax-h3": null,
  "minimax-hailuo-2.3": null,
  "happy-horse-1": null,
  "happy-horse-1.1": null,
  "kling-2.6": null,
  "kling-2.5": null,
  "kling-o3": null,
  "kling-o1": null,
  "ltx-2.5-fast": null,
  "ltx-2.5-pro": null,
  "grok-imagine-video-1.5": null,
  "pixverse-6": null,
  dop: null,
}
