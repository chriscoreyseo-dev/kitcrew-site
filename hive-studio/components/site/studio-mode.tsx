"use client"

import { createContext, useContext } from "react"

import { formatCredits } from "@/lib/credits-format"
import type { CreditUnit } from "@/lib/credits-format"

/** What the browser needs to know about the deployment (D-055). Set once by
    the root layout from the server's STUDIO_MODE. */
export type StudioModeInfo = {
  mode: "standalone" | "markethive"
  unit: CreditUnit
  /** markethive mode: where members add Hive credits (opens in the top window). */
  creditsUrl: string | null
  /** markethive mode: the MarketHive dashboard the studio is opened from. */
  homeUrl: string | null
}

const DEFAULT: StudioModeInfo = {
  mode: "standalone",
  unit: "credits",
  creditsUrl: null,
  homeUrl: null,
}

const StudioModeContext = createContext<StudioModeInfo>(DEFAULT)

export function StudioModeProvider({
  value,
  children,
}: {
  value: StudioModeInfo
  children: React.ReactNode
}) {
  return (
    <StudioModeContext.Provider value={value}>
      {children}
    </StudioModeContext.Provider>
  )
}

export function useStudioMode(): StudioModeInfo {
  return useContext(StudioModeContext)
}

export function useFormatCredits(): (amount: number) => string {
  const { unit } = useStudioMode()
  return (amount) => formatCredits(amount, unit)
}
