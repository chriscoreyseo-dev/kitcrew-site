"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { ActionResult } from "@/lib/action-result"

/** Runs an admin server action, keeps its error for display and refreshes the
    server-rendered page on success. */
export function useAdminAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function execute<T>(
    action: () => Promise<ActionResult<T>>,
    onSuccess?: (data: T) => void
  ) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.message)
        return
      }
      onSuccess?.(result.data)
      router.refresh()
    })
  }

  return { pending, error, setError, execute }
}
