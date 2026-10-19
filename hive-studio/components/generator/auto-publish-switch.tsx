"use client"

import { Globe } from "lucide-react"

/** Generator footer switch (D-065): when on, each new run is published to
    Community as soon as it finishes. Off by default. */
export function AutoPublishSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-center gap-2">
        <Globe aria-hidden className="size-3.5 shrink-0" />
        <span>
          <span className="font-semibold text-foreground">
            Auto-publish to Community
          </span>
          <span className="block">
            {checked
              ? "New creations and their prompts go public when they finish."
              : "Off: new creations stay private."}
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Auto-publish to Community"
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full bg-white/15 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 aria-checked:bg-primary"
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
    </label>
  )
}
