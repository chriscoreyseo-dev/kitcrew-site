import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"

export const metadata: Metadata = { title: "Check your email · Hive Studio" }

export default function CheckEmailPage() {
  return (
    <AuthCard
      title="Check your email"
      description="We sent you a sign-in link. It works once and expires in 30 minutes."
    >
      <Link
        href="/login"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Use a different email
      </Link>
    </AuthCard>
  )
}
