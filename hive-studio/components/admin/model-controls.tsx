"use client"

import { useState } from "react"
import { Pencil, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ModelEntry } from "@/generation/catalog/types"
import {
  adminClearModelPricingAction,
  adminSetModelEnabledAction,
  adminSetModelPricingAction,
} from "@/generation/admin-actions"
import type { PriceRule } from "@/lib/billing/price"

import { ErrorText, tdClass, textareaClass } from "./ui"
import { useAdminAction } from "./use-admin-action"
import { MhSwitch } from "@/components/ui/mh-switch"

const EXAMPLE: PriceRule = { base: { kind: "per_run", usd: 0.05 } }

/** The Enabled and Actions cells of one model row. */
export function ModelControls({
  modelId,
  label,
  enabled,
  hasRuleOverride,
  rule,
  settings,
}: {
  modelId: string
  label: string
  enabled: boolean
  hasRuleOverride: boolean
  rule: PriceRule | null
  settings: ModelEntry["settings"]
}) {
  const toggle = useAdminAction()
  const clear = useAdminAction()
  const [open, setOpen] = useState(false)

  return (
    <>
      <td className={tdClass}>
        <MhSwitch
          checked={enabled}
          label={`${label} enabled`}
          disabled={toggle.pending}
          onChange={(on) =>
            toggle.execute(() =>
              adminSetModelEnabledAction({ modelId, enabled: on })
            )
          }
        />
        {toggle.error ? <ErrorText>{toggle.error}</ErrorText> : null}
      </td>
      <td className={tdClass}>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={`Edit pricing for ${label}`}
          >
            <Pencil aria-hidden />
            Price
          </Button>
          {hasRuleOverride ? (
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={clear.pending}
              aria-label={`Clear pricing override for ${label}`}
              title="Clear override"
              onClick={() =>
                clear.execute(() => adminClearModelPricingAction(modelId))
              }
            >
              <RotateCcw aria-hidden />
            </Button>
          ) : null}
        </div>
        {clear.error ? <ErrorText>{clear.error}</ErrorText> : null}
        {open ? (
          <PricingDialog
            open={open}
            onOpenChange={setOpen}
            modelId={modelId}
            label={label}
            rule={rule}
            settings={settings}
          />
        ) : null}
      </td>
    </>
  )
}

function PricingDialog({
  open,
  onOpenChange,
  modelId,
  label,
  rule,
  settings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  modelId: string
  label: string
  rule: PriceRule | null
  settings: ModelEntry["settings"]
}) {
  const [text, setText] = useState(JSON.stringify(rule ?? EXAMPLE, null, 2))
  const [source, setSource] = useState("")
  const { pending, error, setError, execute } = useAdminAction()

  function save(next: unknown) {
    execute(
      () =>
        adminSetModelPricingAction({
          modelId,
          rule: next,
          ...(source.trim() ? { source: source.trim() } : {}),
        }),
      () => onOpenChange(false)
    )
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError("That isn't valid JSON.")
      return
    }
    // The server validates the shape.
    save(parsed)
  }

  const fields = Object.entries(settings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Pricing: {label}</DialogTitle>
            <DialogDescription>
              What one run costs us in USD. Saved as an override on top of the
              pricing table.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <Label htmlFor="pricing-rule">Rule (JSON)</Label>
              <textarea
                id="pricing-rule"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                spellCheck={false}
                className={textareaClass}
              />
              <div className="text-xs text-muted-foreground">
                <p>
                  base.kind: <code>per_run</code> {"{ usd }"},{" "}
                  <code>per_image</code> {"{ usd, countSetting? }"} or{" "}
                  <code>per_second</code>{" "}
                  {"{ usd, defaultSeconds, durationSetting? }"}. Optional{" "}
                  <code>multipliers</code>:{" "}
                  {'{ "resolution": { "1080p": 1.5 } }'}.
                </p>
                {fields.length ? (
                  <p className="mt-1 break-words">
                    Settings:{" "}
                    {fields
                      .map(([name, f]) =>
                        f.type === "enum"
                          ? `${name} (${f.values.join(" | ")})`
                          : f.type === "range"
                            ? `${name} (${f.min}–${f.max})`
                            : `${name} (on/off)`
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <Label htmlFor="pricing-source">Source (optional)</Label>
              <Input
                id="pricing-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                maxLength={200}
                placeholder="e.g. console export 2026-10"
              />
              {error ? <ErrorText>{error}</ErrorText> : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => save(null)}
            >
              Mark unpriced
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
