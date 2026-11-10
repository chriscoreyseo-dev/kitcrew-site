import { isDisposableEmail } from "@/lib/disposable-domains"

export const MAGIC_LINK_MINUTES = 30

export class AuthEmailError extends Error {
  constructor(readonly code: "invalid" | "disposable") {
    super(
      code === "invalid"
        ? "Enter a valid email address."
        : "Use a permanent email address."
    )
    this.name = "AuthEmailError"
  }
}

/** One address, lower-cased. Shared by the sign-in form and Auth.js. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))
    throw new AuthEmailError("invalid")
  if (isDisposableEmail(email)) throw new AuthEmailError("disposable")
  return email
}

/** Same-origin path only (blocks `//evil.com` and `/\evil.com`); else "/". */
export function safeRedirect(raw: unknown): string {
  const value = typeof raw === "string" ? raw : ""
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
    ? value
    : "/"
}
