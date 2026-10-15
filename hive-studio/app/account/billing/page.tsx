import type { Metadata } from "next"
import Link from "next/link"
import { ObjectId } from "mongodb"
import { redirect } from "next/navigation"

import { PortalButton } from "@/components/billing/portal-button"
import { UpgradeOptions } from "@/components/billing/upgrade-options"
import { balanceOf } from "@/lib/billing/ledger"
import type { LedgerEntry } from "@/lib/billing/ledger"
import { planOf } from "@/lib/billing/plans"
import { db } from "@/lib/db/mongo"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Billing · Hive Studio" }

const REASONS: Record<LedgerEntry["reason"], string> = {
  generation_debit: "Generation",
  generation_refund: "Refund",
  subscription_grant: "Plan credits",
  subscription_reset: "Monthly credits",
  topup_purchase: "Top-up",
  signup_bonus: "Welcome bonus",
  admin_adjust: "Adjustment",
  stripe_refund: "Payment refunded",
}

/** Functional billing page; Phase 6 restyles it to match the site. */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await currentUser()
  if (!user) redirect("/login?next=/account/billing")
  const { checkout } = await searchParams
  const [balance, ledger, doc] = await Promise.all([
    balanceOf(user.id),
    db()
      .collection<LedgerEntry>("credit_ledger")
      .find({ userId: new ObjectId(user.id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    db()
      .collection<{ planRenewsAt?: Date | null }>("users")
      .findOne(
        { _id: new ObjectId(user.id) },
        { projection: { planRenewsAt: 1 } }
      ),
  ])
  const plan = planOf(balance.plan)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight uppercase">
          Billing
        </h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to studio
        </Link>
      </div>
      {checkout === "success" ? (
        <p
          className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm"
          role="status"
        >
          Payment received. Credits appear here as soon as Stripe confirms
          (usually a few seconds).
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total", balance.subscription + balance.topup],
          ["Plan credits", balance.subscription],
          ["Top-up credits", balance.topup],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-muted-foreground uppercase">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">
              ✦ {Number(value).toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 p-4">
        <p className="text-sm">
          Plan: <span className="font-semibold">{plan.name}</span>
          {doc?.planRenewsAt
            ? ` · renews ${doc.planRenewsAt.toLocaleDateString("en-US")}`
            : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Plan credits reset on each renewal. Top-up credits never expire. Plan
          credits are spent first.
        </p>
        <PortalButton />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase">Buy credits</h2>
        <UpgradeOptions />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase">Credit history</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No credit activity yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Date</th>
                <th className="font-normal">What</th>
                <th className="text-right font-normal">Change</th>
                <th className="text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr
                  key={`${e.reason}-${e.refId}`}
                  className="border-t border-white/5"
                >
                  <td className="py-2 text-muted-foreground">
                    {e.createdAt.toLocaleDateString("en-US")}
                  </td>
                  <td>{REASONS[e.reason]}</td>
                  <td
                    className={`text-right font-mono ${e.delta < 0 ? "text-muted-foreground" : "text-primary"}`}
                  >
                    {e.delta > 0 ? "+" : ""}
                    {e.delta.toLocaleString("en-US")}
                  </td>
                  <td className="text-right font-mono">
                    {e.balanceAfter.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
