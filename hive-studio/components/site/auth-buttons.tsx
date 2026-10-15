"use client"

import { useState } from "react"

import { AuthDialog } from "@/components/auth/auth-dialog"
import { Button } from "@/components/ui/button"

/** Signed-out header actions; both open the magic-link modal (one flow signs up and in). */
export function AuthButtons() {
  const [mode, setMode] = useState<"login" | "signup" | null>(null)
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setMode("login")}>
        Login
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMode("signup")}>
        Sign up
      </Button>
      <AuthDialog
        open={mode !== null}
        onOpenChange={(open) => !open && setMode(null)}
        reason={
          mode === "signup"
            ? "Create your account with just your email."
            : undefined
        }
      />
    </>
  )
}
