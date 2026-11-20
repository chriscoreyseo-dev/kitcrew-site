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
  link = false,
}: {
  generationId: string
  onDone?: () => void
  /** A small text link, for the Media Feed post window's row (S624). */
  link?: boolean
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

  if (link)
    return (
      <>
        <button
          type="button"
          onClick={unpublish}
          disabled={pending}
          className="hover:underline disabled:opacity-60"
        >
          {pending ? "Unpublishing…" : "Unpublish"}
        </button>
        {error ? (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </>
    )

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
