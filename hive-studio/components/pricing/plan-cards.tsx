"use client"

import { Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { checkoutAction } from "@/generation/billing-actions"
import type { BillingOption } from "@/generation/billing-actions"
import { cn } from "@/lib/utils"

export type PlanCard = BillingOption & {
  parallel: { image: number; video: number }
  current: boolean
}

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })

/** Plan cards with a monthly/annual toggle. Plans without final numbers say
    "Coming soon" instead of showing a button that can't work. */
export function PlanCards({
  plans,
  signedIn,
}: {
  plans: PlanCard[]
  signedIn: boolean
}) {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const subscribe = (plan: PlanCard) =>
    start(async () => {
      setError(null)
      if (!signedIn) {
        router.push("/login?next=/pricing")
        return
      }
      const r = await checkoutAction({
        kind: "subscription",
        planId: plan.id,
        interval: annual ? "annual" : "monthly",
      })
      if (r.ok) window.location.assign(r.data.url)
      else setError(r.message)
    })

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="mx-auto flex rounded-full bg-ink/5 p-1"
      >
        {(
          [
            [false, "Monthly"],
            [true, "Annual"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={annual === value}
            onClick={() => setAnnual(value)}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground aria-checked:bg-ink/10 aria-checked:text-foreground"
          >
            {label}
            {value ? (
              <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground">
                20% OFF
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const price = annual ? plan.priceAnnualUsd : plan.priceUsd
          const perMonth = annual && price != null ? price / 12 : price
          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col gap-5 rounded-3xl border bg-card p-6",
                plan.badge === "Most popular"
                  ? "border-primary/60"
                  : "border-ink/10"
              )}
            >
              {plan.badge ? (
                <span
                  className={cn(
                    "absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold",
                    plan.badge === "Most popular"
                      ? "bg-primary text-primary-foreground"
                      : "bg-ink/15"
                  )}
                >
                  {plan.badge}
                </span>
              ) : null}
              <div>
                <h2 className="font-heading text-2xl font-bold uppercase">
                  {plan.name}
                </h2>
                <p className="mt-3 font-heading text-4xl font-bold">
                  {perMonth != null ? usd(perMonth) : "TBA"}
                  {perMonth != null ? (
                    <span className="text-base font-normal text-muted-foreground">
                      /mo
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 h-4 text-xs text-muted-foreground">
                  {annual && price != null ? `${usd(price)} billed yearly` : ""}
                </p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                {[
                  plan.credits != null
                    ? `✦ ${plan.credits.toLocaleString("en-US")} credits every month`
                    : "Monthly credits to be announced",
                  `${plan.parallel.video} videos and ${plan.parallel.image} images at once`,
                  "Every model in the studio",
                  "Top-ups at any time, never expire",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <p className="rounded-xl border border-ink/10 py-2.5 text-center text-sm text-muted-foreground">
                  Your plan
                </p>
              ) : plan.available ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => subscribe(plan)}
                  className={cn(
                    "rounded-xl py-2.5 font-semibold",
                    plan.badge === "Most popular"
                      ? "bg-primary text-primary-foreground hover:bg-primary/85"
                      : "border border-ink/15 hover:bg-ink/5"
                  )}
                >
                  {signedIn ? `Get ${plan.name}` : "Sign in to subscribe"}
                </button>
              ) : (
                <p className="rounded-xl border border-dashed border-ink/10 py-2.5 text-center text-sm text-muted-foreground">
                  Coming soon
                </p>
              )}
            </article>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
