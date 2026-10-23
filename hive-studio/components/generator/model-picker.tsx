"use client"

import { useFormatCredits, useStudioMode } from "@/components/site/studio-mode"
/* eslint-disable @next/next/no-img-element */
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ModelEntry } from "@/generation/catalog"
import { modelMeta } from "@/generation/catalog/metadata"
import type { ModelBadge } from "@/generation/catalog/metadata"
import type { Quote } from "@/lib/billing/price"
import { cn } from "@/lib/utils"

export function modelCategory(
  model: ModelEntry
): "FAST" | "CINEMATIC" | "GENERAL" {
  const meta = modelMeta(model.id)
  if (meta?.badges?.includes("FAST")) return "FAST"
  if (/cinema|pro|4k/i.test(`${model.id} ${model.label}`)) return "CINEMATIC"
  return "GENERAL"
}

function Badges({ badges }: { badges?: ModelBadge[] }) {
  if (!badges?.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
            b === "TOP"
              ? "bg-primary text-primary-foreground"
              : "bg-ink/10 text-foreground"
          )}
        >
          {b}
        </span>
      ))}
    </span>
  )
}

function Icon({ model, className }: { model: ModelEntry; className?: string }) {
  return model.icon ? (
    <img
      src={`/model-icons/${model.icon}.svg`}
      alt=""
      aria-hidden
      className={cn("size-5", className)}
    />
  ) : (
    <span aria-hidden className={cn("size-5 rounded bg-ink/10", className)} />
  )
}

/** The panel's model card: category, name, provider, and Change → picker. */
export function ModelCard({
  model,
  models,
  onSelect,
  quoteOf,
}: {
  model: ModelEntry
  models: ModelEntry[]
  onSelect: (id: string) => void
  quoteOf: (model: ModelEntry) => Quote | null
}) {
  const [open, setOpen] = useState(false)
  const meta = modelMeta(model.id)
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-br from-ink/[0.08] via-ink/[0.03] to-transparent p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl"
        />
        <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {modelCategory(model)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Icon model={model} className="size-6" />
          <p className="min-w-0 flex-1 truncate font-heading text-xl font-bold uppercase">
            {model.label}
          </p>
          {models.length > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Change
            </Button>
          ) : null}
        </div>
        {meta ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {meta.description}
          </p>
        ) : null}
        <div className="mt-2">
          <Badges badges={meta?.badges} />
        </div>
      </div>
      <ModelPickerDialog
        open={open}
        onOpenChange={setOpen}
        models={models}
        current={model.id}
        quoteOf={quoteOf}
        onSelect={(id) => {
          onSelect(id)
          setOpen(false)
        }}
      />
    </>
  )
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  models,
  current,
  onSelect,
  quoteOf,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: ModelEntry[]
  current: string
  onSelect: (id: string) => void
  quoteOf: (model: ModelEntry) => Quote | null
}) {
  const fmt = useFormatCredits()
  const { unit } = useStudioMode()
  const [query, setQuery] = useState("")
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = models.filter((m) => {
      const meta = modelMeta(m.id)
      return (
        !q ||
        `${m.label} ${meta?.provider ?? ""} ${meta?.description ?? ""}`
          .toLowerCase()
          .includes(q)
      )
    })
    const byProvider = new Map<string, ModelEntry[]>()
    for (const m of filtered) {
      const provider = modelMeta(m.id)?.provider ?? "Other"
      byProvider.set(provider, [...(byProvider.get(provider) ?? []), m])
    }
    return [...byProvider.entries()]
  }, [models, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Choose a model</DialogTitle>
          <DialogDescription>
            Every model below runs on the same{" "}
            {unit === "hive" ? "Hive credits" : "credits"}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="relative mb-4 block">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="pl-9"
            />
          </label>
          <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No models match.</p>
            ) : null}
            {groups.map(([provider, list]) => (
              <section key={provider}>
                <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {provider}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((m) => {
                    const meta = modelMeta(m.id)
                    const quote = quoteOf(m)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelect(m.id)}
                        aria-pressed={m.id === current}
                        className="flex flex-col gap-1.5 rounded-xl border border-ink/10 p-3 text-left transition-colors hover:bg-ink/5 aria-pressed:border-primary/60 aria-pressed:bg-primary/5"
                      >
                        <span className="flex items-center gap-2">
                          <Icon model={m} />
                          <span className="flex-1 truncate text-sm font-semibold">
                            {m.label}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {quote
                              ? `from ✦${fmt(quote.credits)}`
                              : "Price pending"}
                          </span>
                        </span>
                        {meta ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {meta.description}
                          </span>
                        ) : null}
                        <Badges badges={meta?.badges} />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
