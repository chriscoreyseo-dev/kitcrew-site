"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import { BALANCE_EVENT } from "@/lib/client-events"

import { useFormatCredits, useStudioMode } from "./studio-mode"

/** Credit balance; starts from the server value and follows studio updates. */
export function BalancePill({ initial }: { initial: number }) {
  const [credits, setCredits] = useState(initial)
  const fmt = useFormatCredits()
  const { mode } = useStudioMode()
  useEffect(() => {
    const onBalance = (event: Event) =>
      setCredits((event as CustomEvent<number>).detail)
    window.addEventListener(BALANCE_EVENT, onBalance)
    return () => window.removeEventListener(BALANCE_EVENT, onBalance)
  }, [])
  return (
    <Link
      href="/account"
      className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 font-mono text-sm tabular-nums hover:bg-white/10"
      aria-label={`${fmt(credits)} ${mode === "markethive" ? "Hive credits" : "credits"}. Open account`}
    >
      <Sparkles aria-hidden className="size-3.5 text-primary" />
      {fmt(credits)}
    </Link>
  )
}
