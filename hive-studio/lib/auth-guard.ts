import "server-only"

import { currentUser } from "@/lib/session"

export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in to generate.")
    this.name = "SignInRequiredError"
  }
}

/** Every action and route that spends credits or touches user data calls this
    itself. proxy.ts only redirects; it is never the security boundary. */
export async function requireUser(): Promise<{ userId: string }> {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return { userId: user.id }
}

export class AdminRequiredError extends Error {
  constructor() {
    super("Not found.")
    this.name = "AdminRequiredError"
  }
}

/** Admin-only actions and pages. Non-admins get the same answer as a missing page. */
export async function requireAdmin(): Promise<{ userId: string }> {
  const user = await currentUser()
  if (!user || user.role !== "admin") throw new AdminRequiredError()
  return { userId: user.id }
}
