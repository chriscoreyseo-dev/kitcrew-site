"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { PROMO } from "@/lib/site-config"

const KEY = `hive.promo.dismissed.${PROMO.id}`

export function PromoBar() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(KEY) === "1"
    } catch {
      /* storage blocked: show it */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage, unavailable during SSR
    setVisible(PROMO.enabled && !dismissed)
  }, [])
  if (!visible) return null
  return (
    <div className="relative flex items-center justify-center gap-2 bg-primary px-10 py-1.5 text-center text-xs font-semibold text-primary-foreground">
      {PROMO.href ? (
        <Link href={PROMO.href} className="underline-offset-2 hover:underline">
          {PROMO.text}
        </Link>
      ) : (
        PROMO.text
      )}
      <button
        type="button"
        aria-label="Dismiss announcement"
        className="absolute right-2 flex size-6 items-center justify-center rounded hover:bg-black/10"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1")
          } catch {
            /* ignore */
          }
          setVisible(false)
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
