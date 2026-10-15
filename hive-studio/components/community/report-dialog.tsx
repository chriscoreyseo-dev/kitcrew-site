"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { Flag, Loader2 } from "lucide-react"

import { reportGenerationAction } from "@/generation/community-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const REASONS = [
  { id: "nsfw", label: "Sexual or explicit content" },
  { id: "hateful", label: "Hateful, violent or harassing" },
  { id: "copyright", label: "Copyright or someone's likeness" },
  { id: "spam", label: "Spam or misleading" },
  { id: "other", label: "Something else" },
] as const

type Reason = (typeof REASONS)[number]["id"]

export function ReportDialog({ generationId }: { generationId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason || pending) return
    setError(null)
    startTransition(async () => {
      const result = await reportGenerationAction(
        generationId,
        reason,
        note.trim() || undefined
      )
      if (result.ok) {
        setDone(true)
        return
      }
      if (result.code === "SIGN_IN") setNeedsSignIn(true)
      setError(result.message)
    })
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && done) {
      setReason(null)
      setNote("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="lg" className="text-muted-foreground">
            <Flag aria-hidden />
            Report
          </Button>
        }
      />
      <DialogContent size="sm">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Report this creation</DialogTitle>
            <DialogDescription>
              Tell us what&apos;s wrong. Reports are private and reviewed by our
              team.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {done ? (
              <p className="text-sm" role="status">
                Thanks. We&apos;ll review it soon.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-2 text-sm font-medium">Reason</legend>
                  {REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-sm transition-colors hover:bg-white/5 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                        reason === r.id && "border-white/30 bg-white/5"
                      )}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="size-4 accent-foreground"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="report-note">
                    Note{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <textarea
                    id="report-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Anything that helps us review it"
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}{" "}
                    {needsSignIn ? (
                      <Link
                        href={`/login?next=/g/${generationId}`}
                        className="underline"
                      >
                        Sign in
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {done ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            ) : (
              <Button
                type="submit"
                variant="outline"
                disabled={!reason || pending}
              >
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                Send report
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
