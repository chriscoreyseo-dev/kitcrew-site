import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { signOutAction } from "@/app/login/actions"
import { Page, SectionTitle } from "@/components/site/page"
import { Button } from "@/components/ui/button"
import { balanceOf } from "@/lib/billing/ledger"
import { planOf } from "@/lib/billing/plans"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Account · Hive Studio" }

/** The real gate is here, not proxy.ts. */
export default async function AccountPage() {
  const user = await currentUser()
  if (!user) redirect("/login?next=/account")
  const balance = await balanceOf(user.id).catch(() => ({
    subscription: 0,
    topup: 0,
    plan: "free",
  }))
  const plan = planOf(balance.plan)
  return (
    <Page title="Account" width="narrow">
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Credits", balance.subscription + balance.topup],
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

      <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 p-5">
        <SectionTitle className="mb-0">Profile</SectionTitle>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{user.email}</dd>
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{plan.name}</dd>
          <dt className="text-muted-foreground">Sign-in</dt>
          <dd>Email link (no password)</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/account/billing"
            className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
          >
            Billing and credit history
          </Link>
          <Link
            href="/assets"
            className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
          >
            My library
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="default">
              Sign out
            </Button>
          </form>
        </div>
      </section>
    </Page>
  )
}
