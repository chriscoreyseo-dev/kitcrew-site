"use client"

import { Globe } from "lucide-react"

/** Generator footer switch (D-065): when on, each new run is published to
    Community as soon as it finishes. Off by default. Drawn as MarketHive's own
    switch (the dashboard's MEMB/CORP toggle, Tom S572/S575): a pill with a navy
    border, a white knob that slides, white copy; ON on the button blue #6d83b4,
    OFF on the light blue #a1b1d1. */
export function AutoPublishSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
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
        className="mh-switch"
      >
        <span aria-hidden className="mh-switch-knob" />
        <span aria-hidden className="mh-switch-label">
          {checked ? "ON" : "OFF"}
        </span>
      </button>
    </label>
  )
}
