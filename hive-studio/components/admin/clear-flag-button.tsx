"use client"

import { Button } from "@/components/ui/button"
import { adminClearBillingFlagAction } from "@/generation/admin-actions"

import { ErrorText } from "./ui"
import { useAdminAction } from "./use-admin-action"

export function ClearFlagButton({ userId }: { userId: string }) {
  const { pending, error, execute } = useAdminAction()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => execute(() => adminClearBillingFlagAction(userId))}
      >
        {pending ? "Clearing…" : "Clear flag"}
      </Button>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </>
  )
}
