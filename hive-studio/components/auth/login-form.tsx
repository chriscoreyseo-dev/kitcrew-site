"use client"

import { MailCheck } from "lucide-react"
import { useActionState, useId } from "react"

import { requestMagicLink } from "@/app/login/actions"
import type { MagicLinkState } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL: MagicLinkState = { status: "idle" }

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, INITIAL)
  const id = useId()

  if (state.status === "sent")
    return (
      <div
        className="flex flex-col items-center gap-3 py-2 text-center"
        role="status"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <p className="text-base font-semibold">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to{" "}
          <span className="text-foreground">{state.email}</span>. It expires in
          30 minutes. You can close this window.
        </p>
      </div>
    )

  const errorId = `${id}-error`
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Label htmlFor={`${id}-email`}>Email</Label>
      <Input
        id={`${id}-email`}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        required
        autoFocus
        aria-invalid={state.status === "error" || undefined}
        aria-describedby={state.status === "error" ? errorId : undefined}
      />
      {state.status === "error" ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="mt-1 h-11 font-semibold uppercase"
        disabled={pending}
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No password. New here? The same link creates your account.
      </p>
    </form>
  )
}
