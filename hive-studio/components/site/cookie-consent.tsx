"use client"

import { useEffect, useState } from "react"

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

const KEY = "hive.consent.v1"
export type Consent = { essential: true; analytics: boolean; decidedAt: number }

/** Read consent before loading any analytics. No analytics ship yet; anything
    added later must check `hasAnalyticsConsent()` first. */
export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Consent).analytics === true : false
  } catch {
    return false
  }
}

function save(analytics: boolean) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        essential: true,
        analytics,
        decidedAt: Date.now(),
      } satisfies Consent)
    )
  } catch {
    /* storage blocked: banner will show again next visit */
  }
}

export function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  useEffect(() => {
    let decided = false
    try {
      decided = Boolean(localStorage.getItem(KEY))
    } catch {
      decided = false
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage, unavailable during SSR
    setOpen(!decided)
  }, [])
  if (!open) return null
  const decide = (value: boolean) => {
    save(value)
    setOpen(false)
    setPrefs(false)
  }
  return (
    <>
      <div
        role="region"
        aria-label="Cookie consent"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-ink/10 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center"
      >
        <p className="flex-1 text-sm text-muted-foreground">
          We use essential cookies to keep you signed in. With your OK we&apos;d
          also use analytics cookies to improve the product.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPrefs(true)}>
            Preferences
          </Button>
          <Button variant="outline" size="sm" onClick={() => decide(false)}>
            Reject non-essential
          </Button>
          <Button variant="outline" size="sm" onClick={() => decide(true)}>
            Accept all
          </Button>
        </div>
      </div>
      <Dialog open={prefs} onOpenChange={setPrefs}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Essential cookies are always on; they keep you signed in and
              secure.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 p-3 text-sm">
              <span>
                <span className="font-semibold">Analytics</span>
                <span className="block text-xs text-muted-foreground">
                  Anonymous usage stats to improve the product.
                </span>
              </span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => decide(analytics)}>
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
