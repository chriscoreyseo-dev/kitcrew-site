"use client"

import { useState, useTransition } from "react"

import { portalAction } from "@/generation/billing-actions"
import { Button } from "@/components/ui/button"

export function PortalButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await portalAction()
            if (r.ok) window.location.assign(r.data.url)
            else setError(r.message)
          })
        }
      >
        Manage subscription and invoices
      </Button>
      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
    </div>
  )
}
