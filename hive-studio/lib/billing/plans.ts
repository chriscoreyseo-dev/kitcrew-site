import type { Surface } from "@/generation/catalog/types"

/** Plans and top-ups. Every money amount and credit allowance is TBD until the
    operator sets final numbers (Phase 5 checkpoint). A plan or pack with a
    null amount, or without its Stripe price id in env, can't be bought. No
    "unlimited" tiers: every generation costs real money upstream. */

export type PlanId = "free" | "starter" | "plus" | "ultra"
export type Interval = "monthly" | "annual"

export type Plan = {
  id: PlanId
  name: string
  /** Subscription credits granted (reset, not added) on every paid invoice. */
  monthlyCredits: number | null
  priceMonthlyUsd: number | null
  /** Full annual price; the page shows the per-month equivalent and "20% OFF". */
  priceAnnualUsd: number | null
  stripePriceEnv?: Record<Interval, string>
  /** Runs in flight at once, per surface ("parallel generations"). */
  concurrency: Record<Surface, number>
  /** Top-up credits multiplier: higher plans get more credits per dollar. */
  topupBonus: number
  badge?: "Most popular" | "Best value"
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthlyCredits: 0,
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    concurrency: { image: 1, video: 1, audio: 1 },
    topupBonus: 1,
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyCredits: null,
    priceMonthlyUsd: null,
    priceAnnualUsd: null,
    stripePriceEnv: {
      monthly: "STRIPE_PRICE_STARTER_MONTHLY",
      annual: "STRIPE_PRICE_STARTER_ANNUAL",
    },
    concurrency: { image: 4, video: 2, audio: 2 },
    topupBonus: 1,
  },
  plus: {
    id: "plus",
    name: "Plus",
    monthlyCredits: null,
    priceMonthlyUsd: null,
    priceAnnualUsd: null,
    stripePriceEnv: {
      monthly: "STRIPE_PRICE_PLUS_MONTHLY",
      annual: "STRIPE_PRICE_PLUS_ANNUAL",
    },
    concurrency: { image: 8, video: 6, audio: 4 },
    topupBonus: 1,
    badge: "Most popular",
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    monthlyCredits: null,
    priceMonthlyUsd: null,
    priceAnnualUsd: null,
    stripePriceEnv: {
      monthly: "STRIPE_PRICE_ULTRA_MONTHLY",
      annual: "STRIPE_PRICE_ULTRA_ANNUAL",
    },
    concurrency: { image: 12, video: 8, audio: 6 },
    topupBonus: 1,
    badge: "Best value",
  },
}

export type TopupId = "small" | "medium" | "large"

export type Topup = {
  id: TopupId
  name: string
  credits: number | null
  priceUsd: number | null
  stripePriceEnv: string
}

export const TOPUPS: Record<TopupId, Topup> = {
  small: {
    id: "small",
    name: "Small pack",
    credits: null,
    priceUsd: null,
    stripePriceEnv: "STRIPE_PRICE_TOPUP_SMALL",
  },
  medium: {
    id: "medium",
    name: "Medium pack",
    credits: null,
    priceUsd: null,
    stripePriceEnv: "STRIPE_PRICE_TOPUP_MEDIUM",
  },
  large: {
    id: "large",
    name: "Large pack",
    credits: null,
    priceUsd: null,
    stripePriceEnv: "STRIPE_PRICE_TOPUP_LARGE",
  },
}

export function planOf(id: unknown): Plan {
  return typeof id === "string" && id in PLANS
    ? PLANS[id as PlanId]
    : PLANS.free
}

/** Credits a top-up grants for a user on `plan` (never from client input). */
export function topupCredits(pack: Topup, plan: Plan): number | null {
  return pack.credits === null
    ? null
    : Math.floor(pack.credits * plan.topupBonus)
}

/** Reverse lookup used by the Stripe webhook: env price id → plan + interval. */
export function planForPriceId(
  priceId: string,
  env: Record<string, string | undefined>
): { plan: Plan; interval: Interval } | null {
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripePriceEnv) continue
    for (const interval of ["monthly", "annual"] as const)
      if (env[plan.stripePriceEnv[interval]] === priceId)
        return { plan, interval }
  }
  return null
}

export function topupForPriceId(
  priceId: string,
  env: Record<string, string | undefined>
): Topup | null {
  return (
    Object.values(TOPUPS).find((t) => env[t.stripePriceEnv] === priceId) ?? null
  )
}
