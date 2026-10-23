"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminAdjustCreditsAction } from "@/generation/admin-actions"

import { ErrorText, selectClass } from "./ui"
import { useAdminAction } from "./use-admin-action"

/** Signed delta + bucket + required note. The token is minted when the form
    renders and sent with every submit, so a double submit applies once; a
    fresh token is minted only after a submit succeeds. */
export function CreditAdjustForm({
  userId,
  initialToken,
}: {
  userId: string
  initialToken: string
}) {
  const [token, setToken] = useState(initialToken)
  const [delta, setDelta] = useState("")
  const [bucket, setBucket] = useState<"subscription" | "topup">("topup")
  const [note, setNote] = useState("")
  const [done, setDone] = useState<string | null>(null)
  const { pending, error, setError, execute } = useAdminAction()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDone(null)
    const value = Number(delta)
    if (!Number.isInteger(value) || value === 0) {
      setError("Enter a whole number other than 0, e.g. 100 or -50.")
      return
    }
    if (!note.trim()) {
      setError("A note is required.")
      return
    }
    execute(
      () =>
        adminAdjustCreditsAction({ userId, delta: value, bucket, note, token }),
      (data) => {
        setDone(
          data.applied
            ? `Applied. Plan credits ${data.credits.subscription.toLocaleString("en-US")}, top-up ${data.credits.topup.toLocaleString("en-US")}.`
            : "Already applied (same submission)."
        )
        setToken(crypto.randomUUID())
        setDelta("")
        setNote("")
      }
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-ink/10 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="adjust-delta">Credits (+/−)</Label>
          <Input
            id="adjust-delta"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 100 or -50"
            required
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="adjust-bucket">Bucket</Label>
          <select
            id="adjust-bucket"
            className={selectClass}
            value={bucket}
            onChange={(e) =>
              setBucket(
                e.target.value === "subscription" ? "subscription" : "topup"
              )
            }
          >
            <option value="topup">Top-up</option>
            <option value="subscription">Plan (subscription)</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adjust-note">Note (required)</Label>
        <Input
          id="adjust-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Why, e.g. support ticket #123"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Balances never go below zero; a larger debit is clamped.
      </p>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {done ? (
        <p role="status" className="text-sm text-emerald-300">
          {done}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Applying…" : "Apply adjustment"}
      </Button>
    </form>
  )
}
