import "server-only"

import { GenerationForbiddenError } from "@/lib/access"
import { SignInRequiredError } from "@/lib/auth-guard"
import {
  ConcurrencyLimitError,
  InsufficientCreditsError,
} from "@/lib/billing/ledger"
import { EnvError } from "@/lib/env"
import {
  GenerationInputError,
  GenerationNotFoundError,
} from "@/lib/generations/lifecycle"

export type ActionErrorCode =
  | "SIGN_IN"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "RATE_LIMITED"
  | "INSUFFICIENT_CREDITS"
  | "PARALLEL_LIMIT"
  | "UNAVAILABLE"
  | "FAILED"

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string }

export class RateLimitedError extends Error {
  constructor(message = "Too many requests. Wait a moment and try again.") {
    super(message)
    this.name = "RateLimitedError"
  }
}

/** Server actions return results instead of throwing: production Next hides
    thrown messages, and the dock needs a plain-language reason. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    if (error instanceof SignInRequiredError)
      return { ok: false, code: "SIGN_IN", message: error.message }
    if (error instanceof GenerationForbiddenError)
      return { ok: false, code: "FORBIDDEN", message: error.message }
    if (error instanceof GenerationNotFoundError)
      return { ok: false, code: "NOT_FOUND", message: error.message }
    if (error instanceof GenerationInputError)
      return { ok: false, code: "INVALID", message: error.message }
    if (error instanceof InsufficientCreditsError)
      return { ok: false, code: "INSUFFICIENT_CREDITS", message: error.message }
    if (error instanceof ConcurrencyLimitError)
      return { ok: false, code: "PARALLEL_LIMIT", message: error.message }
    if (error instanceof RateLimitedError)
      return { ok: false, code: "RATE_LIMITED", message: error.message }
    if (error instanceof EnvError) {
      console.error(`[action] ${error.message}`)
      return {
        ok: false,
        code: "UNAVAILABLE",
        message: "Generation is temporarily unavailable.",
      }
    }
    console.error("[action] failed", error)
    return {
      ok: false,
      code: "FAILED",
      message: "Something went wrong. Try again.",
    }
  }
}
