"use server"

import { AuthError } from "next-auth"

import { MagicLinkRateLimitError, signIn, signOut } from "@/auth"
import { AuthEmailError, normalizeEmail, safeRedirect } from "@/lib/auth-email"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { EnvError } from "@/lib/env"
import {
  endMarketHiveSession,
  MH_SESSION_COOKIE,
} from "@/lib/markethive/session"
import { isMarketHive } from "@/lib/mode"

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string }

/** Auth.js wraps provider errors; find ours anywhere in the cause chain. */
function findCause<T extends Error>(
  error: unknown,
  type: new (...args: never[]) => T
): T | null {
  let current: unknown = error
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current instanceof type) return current
    const cause: unknown = (current as { cause?: unknown }).cause
    current =
      cause && typeof cause === "object" && "err" in cause
        ? (cause as { err: unknown }).err
        : cause
  }
  return null
}

export async function requestMagicLink(
  _previous: MagicLinkState,
  form: FormData
): Promise<MagicLinkState> {
  if (isMarketHive())
    return {
      status: "error",
      message: "Sign in from your MarketHive dashboard.",
    }
  let email: string
  try {
    email = normalizeEmail(String(form.get("email") ?? ""))
  } catch (error) {
    if (error instanceof AuthEmailError)
      return { status: "error", message: error.message }
    throw error
  }

  try {
    await signIn("resend", {
      email,
      redirect: false,
      redirectTo: safeRedirect(form.get("redirectTo")),
    })
    return { status: "sent", email }
  } catch (error) {
    if (findCause(error, MagicLinkRateLimitError))
      return {
        status: "error",
        message: "Too many sign-in emails. Wait a few minutes and try again.",
      }
    const emailError = findCause(error, AuthEmailError)
    if (emailError) return { status: "error", message: emailError.message }
    if (error instanceof EnvError || findCause(error, EnvError)) {
      console.error(`[auth] ${error instanceof Error ? error.message : error}`)
      return { status: "error", message: "Sign-in is temporarily unavailable." }
    }
    if (error instanceof AuthError) {
      console.error("[auth] magic link failed", error.type)
      return {
        status: "error",
        message: "We couldn't send the email. Try again in a moment.",
      }
    }
    throw error
  }
}

export async function signOutAction() {
  if (isMarketHive()) {
    const jar = await cookies()
    await endMarketHiveSession(jar.get(MH_SESSION_COOKIE)?.value)
    jar.set(MH_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
      maxAge: 0,
    })
    redirect("/")
  }
  await signOut({ redirectTo: "/" })
}
