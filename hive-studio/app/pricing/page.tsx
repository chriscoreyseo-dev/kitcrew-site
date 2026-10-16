import type { Metadata } from "next"

import { UpgradeOptions } from "@/components/billing/upgrade-options"
import { MarketHivePricing } from "@/components/pricing/markethive-pricing"
import { PlanCards } from "@/components/pricing/plan-cards"
import type { PlanCard } from "@/components/pricing/plan-cards"
import { Page, SectionTitle } from "@/components/site/page"
import { billingOptionsAction } from "@/generation/billing-actions"
import { balanceFor } from "@/lib/billing/wallet"
import { PLANS } from "@/lib/billing/plans"
import type { PlanId } from "@/lib/billing/plans"
import { isMarketHive } from "@/lib/mode"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Pricing · Hive Studio" }

const FAQ: [string, string][] = [
  [
    "How do credits work?",
    "Every generation shows its price in credits on the Generate button before you run it. Credits are taken when you start a run and returned automatically if it fails, is blocked by the content filter, or you cancel it while it's queued.",
  ],
  [
    "What's the difference between plan credits and top-ups?",
    "Plan credits refill to your plan's allowance every billing month and are used first. Top-up credits are bought once, never expire, and are used after plan credits run out.",
  ],
  [
    "Can I cancel anytime?",
    "Yes. Cancel from Billing; you keep your plan and its credits until the end of the period you've paid for. Top-up credits stay with your account.",
  ],
  [
    "Why do models cost different amounts?",
    "Each model costs a different amount to run, and video is priced by length and resolution. The button always shows the exact price for your settings.",
  ],
  [
    "Do I own what I make?",
    "See our Terms for how you can use your generations, including any limits set by the model providers.",
  ],
]

export default async function PricingPage() {
  if (isMarketHive()) return <MarketHivePricing />
  const user = await currentUser()
  const [options, current] = await Promise.all([
    billingOptionsAction(),
    user
      ? balanceFor(user.id)
          .then((b) => b.plan)
          .catch(() => "free")
      : Promise.resolve("free"),
  ])
  const list = options.ok ? options.data : []
  const plans: PlanCard[] = list
    .filter((o) => o.kind === "subscription")
    .map((o) => {
      const plan = PLANS[o.id as PlanId]
      return {
        ...o,
        parallel: {
          image: plan.concurrency.image,
          video: plan.concurrency.video,
        },
        current: current === o.id,
      }
    })

  return (
    <Page
      title="Pricing"
      subtitle="Pay for what you make. Pick a plan for monthly credits, or top up whenever you need more."
    >
      <PlanCards plans={plans} signedIn={Boolean(user)} />

      <section className="mt-16">
        <SectionTitle>Compare plans</SectionTitle>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-white/[0.03] text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-normal">Feature</th>
                {(["free", "starter", "plus", "ultra"] as const).map((id) => (
                  <th key={id} className="p-3 font-semibold text-foreground">
                    {PLANS[id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Monthly credits",
                  (id: PlanId) =>
                    PLANS[id].monthlyCredits?.toLocaleString("en-US") ?? "TBA",
                ],
                [
                  "Videos at once",
                  (id: PlanId) => String(PLANS[id].concurrency.video),
                ],
                [
                  "Images at once",
                  (id: PlanId) => String(PLANS[id].concurrency.image),
                ],
                ["All models", () => "✓"],
                ["Top-ups", () => "✓"],
                ["Community sharing", () => "✓"],
              ].map(([label, value]) => (
                <tr key={label as string} className="border-t border-white/5">
                  <td className="p-3 text-muted-foreground">
                    {label as string}
                  </td>
                  {(["free", "starter", "plus", "ultra"] as const).map((id) => (
                    <td key={id} className="p-3 font-mono">
                      {(value as (id: PlanId) => string)(id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div>
          <SectionTitle>Top-up packs</SectionTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            One-time credits that never expire. Higher plans get more credits
            per dollar.
          </p>
          {user ? (
            <UpgradeOptions />
          ) : (
            <a
              href="/login?next=/pricing"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Sign in to buy credits
            </a>
          )}
        </div>
        <div>
          <SectionTitle>Questions</SectionTitle>
          <div className="flex flex-col divide-y divide-white/5 rounded-2xl border border-white/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  {q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Page>
  )
}
