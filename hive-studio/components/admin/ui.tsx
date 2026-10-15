import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Small shared pieces for the admin tables and forms. */

export const fieldClass =
  "w-full min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 [&>option]:bg-background"

export const selectClass = cn(fieldClass, "h-10")

export const textareaClass = cn(fieldClass, "py-2 font-mono text-xs")

/** Horizontal scroll lives here, never on the page. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10">
      {children}
    </div>
  )
}

export const tableClass = "w-full text-left text-sm"
export const thClass =
  "px-3 py-2 text-xs font-normal whitespace-nowrap text-muted-foreground"
export const tdClass = "px-3 py-2 align-top"
export const rowClass = "border-t border-white/5"

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "warn" | "good" | "bad"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap",
        tone === "neutral" && "bg-white/10 text-muted-foreground",
        tone === "warn" && "bg-amber-500/15 text-amber-300",
        tone === "good" && "bg-emerald-500/15 text-emerald-300",
        tone === "bad" && "bg-red-500/15 text-red-300"
      )}
    >
      {children}
    </span>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-300">
      {children}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })
}
