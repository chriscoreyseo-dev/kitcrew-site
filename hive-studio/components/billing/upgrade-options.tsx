"use client"

import { useEffect, useState, useTransition } from "react"

import {
  billingOptionsAction,
  checkoutAction,
} from "@/generation/billing-actions"
import type { BillingOption } from "@/generation/billing-actions"
import { Button } from "@/components/ui/button"

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })

/** Top-up packs and plans with Stripe Checkout buttons. Options without final
    prices show "Coming soon" instead of an inert button. */
export function UpgradeOptions() {
  const [options, setOptions] = useState<BillingOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void billingOptionsAction().then((r) =>
      r.ok ? setOptions(r.data) : setError(r.message)
    )
  }, [])

  const buy = (option: BillingOption) =>
    startTransition(async () => {
      setError(null)
      const r = await checkoutAction(
        option.kind === "topup"
          ? { kind: "topup", packId: option.id }
          : { kind: "subscription", planId: option.id, interval: "monthly" }
      )
      if (r.ok) window.location.assign(r.data.url)
      else setError(r.message)
    })

  if (!options)
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading options…"}
      </p>
    )

  const section = (kind: BillingOption["kind"], title: string) => (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </p>
      {options
        .filter((o) => o.kind === kind)
        .map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {o.name}
                {o.badge ? (
                  <span className="ml-2 text-xs text-primary">{o.badge}</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.credits !== null
                  ? `✦ ${o.credits.toLocaleString("en-US")} credits${kind === "subscription" ? " / month" : ""}`
                  : "Credits to be announced"}
                {o.priceUsd !== null
                  ? ` · ${usd(o.priceUsd)}${kind === "subscription" ? "/mo" : ""}`
                  : ""}
              </p>
            </div>
            {o.available ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => buy(o)}
              >
                {kind === "topup" ? "Buy" : "Subscribe"}
              </Button>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                Coming soon
              </span>
            )}
          </div>
        ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {section("topup", "Top-up packs")}
      {section("subscription", "Plans")}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
