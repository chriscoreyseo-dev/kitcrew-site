import "server-only"

import { auth } from "@/auth"
import type { Role } from "@/types/next-auth"
import { EnvError } from "@/lib/env"

export type CurrentUser = { id: string; email: string; role: Role }

/** The signed-in user, or null. Returns null (with a dev warning) instead of
    throwing when auth isn't configured yet, so public pages still render. */
export async function currentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth()
    const user = session?.user
    if (!user?.id || !user.email) return null
    return { id: user.id, email: user.email, role: user.role }
  } catch (error) {
    if (error instanceof EnvError) {
      if (process.env.NODE_ENV !== "production")
        console.warn(`[auth] ${error.message}`)
      return null
    }
    throw error
  }
}
