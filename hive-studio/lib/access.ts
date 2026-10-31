import "server-only"

import { env } from "@/lib/env"
import type { CurrentUser } from "@/lib/session"

export class GenerationForbiddenError extends Error {
  constructor() {
    super("Generation isn't open to your account yet.")
    this.name = "GenerationForbiddenError"
  }
}

/** Until billing ships, production generation is limited by GENERATION_ACCESS
    (default "admins") so sign-ups can't spend the platform key for free.
    Make someone an admin: set `role: "admin"` on their users document. */
export function assertCanGenerate(user: CurrentUser): void {
  if (process.env.NODE_ENV !== "production") return
  if (env().GENERATION_ACCESS === "everyone") return
  if (user.role !== "admin") throw new GenerationForbiddenError()
}
