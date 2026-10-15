import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = { title: "Sign-in problem · Hive Studio" }

const MESSAGES: Record<string, string> = {
  Verification:
    "This sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "This email can't be used to sign in.",
  EmailSignin: "We couldn't send the sign-in email. Try again in a moment.",
  Configuration: "Sign-in is temporarily unavailable. Try again shortly.",
}

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { error } = await searchParams
  const message =
    (typeof error === "string" && MESSAGES[error]) ||
    "Something went wrong signing you in."
  return (
    <AuthCard
      title="Couldn't sign you in"
      description={
        <>
          {message} Still stuck? Email{" "}
          <a
            className="text-foreground underline"
            href={`mailto:${BRAND.supportEmail}`}
          >
            {BRAND.supportEmail}
          </a>
          .
        </>
      }
    >
      <Link
        href="/login"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </AuthCard>
  )
}
