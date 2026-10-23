"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { EyeOff, Loader2 } from "lucide-react"

import { publishGenerationAction } from "@/generation/community-actions"
import { Button } from "@/components/ui/button"

/** Owner-only: take a creation off the community feed. `onDone` replaces the
    trip back to /community (the feed's post window drops the post in place). */
export function UnpublishButton({
  generationId,
  onDone,
}: {
  generationId: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function unpublish() {
    setError(null)
    startTransition(async () => {
      const result = await publishGenerationAction(generationId, false)
      if (!result.ok) {
        setError(result.message)
        return
      }
      if (onDone) return onDone()
      router.push("/community")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="lg"
        onClick={unpublish}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <EyeOff aria-hidden />
        )}
        Unpublish
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
