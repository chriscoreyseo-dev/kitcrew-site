import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { signOutAction } from "@/app/login/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Account · Hive Studio" }

/** Minimal until Phase 6 (balance, ledger, plan). The real gate is here, not proxy.ts. */
export default async function AccountPage() {
  const user = await currentUser()
  if (!user) redirect("/login?next=/account")
  return (
    <AuthCard
      title="Account"
      description={
        <>
          Signed in as <span className="text-foreground">{user.email}</span>
        </>
      }
    >
      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthCard>
  )
}
