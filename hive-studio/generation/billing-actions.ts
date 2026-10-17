"use server"

import { z } from "zod"

import { run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import {
  createPortalSession,
  createSubscriptionCheckout,
  createTopupCheckout,
} from "@/lib/billing/checkout"
import { balanceFor } from "@/lib/billing/wallet"
import type { PriceRule } from "@/lib/billing/price"
import { clientPricing } from "@/lib/billing/pricing"
import { PLANS, TOPUPS, planOf, topupCredits } from "@/lib/billing/plans"
import { env } from "@/lib/env"
import { GenerationInputError } from "@/lib/generations/lifecycle"
import { hit } from "@/lib/rate-limit"
import { currentUser } from "@/lib/session"

async function signedIn() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return user
}

const CHECKOUT = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("subscription"),
    planId: z.enum(["starter", "plus", "ultra"]),
    interval: z.enum(["monthly", "annual"]),
  }),
  z.object({
    kind: z.literal("topup"),
    packId: z.enum(["small", "medium", "large"]),
  }),
])

export async function checkoutAction(
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    const user = await signedIn()
    const parsed = CHECKOUT.safeParse(input)
    if (!parsed.success)
      throw new GenerationInputError("Invalid checkout request.")
    const limit = await hit({
      scope: "checkout",
      id: user.id,
      max: 10,
      windowSec: 60,
    })
    if (!limit.ok)
      throw new GenerationInputError(
        "Too many checkout attempts. Wait a minute."
      )
    const url =
      parsed.data.kind === "subscription"
        ? await createSubscriptionCheckout(
            user.id,
            parsed.data.planId,
            parsed.data.interval
          )
        : await createTopupCheckout(user.id, parsed.data.packId)
    return { url }
  })
}

export async function portalAction(): Promise<ActionResult<{ url: string }>> {
  return run(async () => ({
    url: await createPortalSession((await signedIn()).id),
  }))
}

export async function balanceAction(): Promise<
  ActionResult<{ subscription: number; topup: number; plan: string }>
> {
  return run(async () => balanceFor((await signedIn()).id))
}

/** Public: price rules in credit units (no markup or upstream cost revealed),
    so the Generate button shows the same number the server will charge. */
export async function pricingAction(): Promise<
  ActionResult<Record<string, { rule: PriceRule | null; enabled: boolean }>>
> {
  return run(async () => clientPricing())
}

export type BillingOption = {
  kind: "subscription" | "topup"
  id: string
  name: string
  credits: number | null
  priceUsd: number | null
  priceAnnualUsd?: number | null
  badge?: string
  /** False until amounts and the Stripe price id are configured. */
  available: boolean
}

/** What can actually be bought right now (amounts set + Stripe price in env). */
export async function billingOptionsAction(): Promise<
  ActionResult<BillingOption[]>
> {
  return run(async () => {
    const e = env() as unknown as Record<string, string | undefined>
    const user = await currentUser()
    const plan = planOf(user ? (await balanceFor(user.id)).plan : "free")
    const plans: BillingOption[] = (["starter", "plus", "ultra"] as const).map(
      (id) => {
        const p = PLANS[id]
        return {
          kind: "subscription",
          id,
          name: p.name,
          credits: p.monthlyCredits,
          priceUsd: p.priceMonthlyUsd,
          priceAnnualUsd: p.priceAnnualUsd,
          ...(p.badge ? { badge: p.badge } : {}),
          available:
            p.monthlyCredits !== null &&
            p.priceMonthlyUsd !== null &&
            Boolean(p.stripePriceEnv && e[p.stripePriceEnv.monthly]),
        }
      }
    )
    const packs: BillingOption[] = Object.values(TOPUPS).map((t) => {
      const credits = topupCredits(t, plan)
      return {
        kind: "topup",
        id: t.id,
        name: t.name,
        credits,
        priceUsd: t.priceUsd,
        available:
          credits !== null &&
          t.priceUsd !== null &&
          Boolean(e[t.stripePriceEnv]),
      }
    })
    return [...packs, ...plans]
  })
}
