import "server-only"

/** Interim gate until Auth.js lands (Phase 2). Every action that spends the
    platform key calls this. Development is open so the studio can be exercised
    locally; production refuses, so a deploy made before sign-in exists cannot
    spend credits on Higgsfield for anonymous visitors.
    Phase 2 replaces the body with `auth()` + a user id. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in to generate.")
    this.name = "SignInRequiredError"
  }
}

export async function requireUser(): Promise<{ userId: string }> {
  if (process.env.NODE_ENV === "production") throw new SignInRequiredError()
  return { userId: "dev-local" }
}
