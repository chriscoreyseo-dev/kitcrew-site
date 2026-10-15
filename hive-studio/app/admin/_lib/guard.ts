import "server-only"

import { notFound } from "next/navigation"

import { AdminRequiredError, requireAdmin } from "@/lib/auth-guard"

/** Admin pages answer non-admins (and signed-out visitors) with a 404. */
export async function adminOr404(): Promise<{ userId: string }> {
  try {
    return await requireAdmin()
  } catch (error) {
    if (error instanceof AdminRequiredError) notFound()
    throw error
  }
}
