import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { LoginForm } from "@/components/auth/login-form"
import { safeRedirect } from "@/lib/auth-email"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Sign in · Hive Studio" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = safeRedirect(params.callbackUrl ?? params.next)
  if (await currentUser()) redirect(next)
  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and we'll send you a sign-in link."
    >
      <LoginForm redirectTo={next} />
    </AuthCard>
  )
}
