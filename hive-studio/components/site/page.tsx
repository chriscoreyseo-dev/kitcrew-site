import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Standard content page under the site header: centered column, consistent
    padding, optional uppercase display title. Use for every non-studio page. */
export function Page({
  title,
  subtitle,
  actions,
  width = "default",
  pageModeTitle = true,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** false: under MarketHive's /hivestudio toolbar (page mode), which already
      names the page, the title and subtitle step aside (S611, Tom). */
  pageModeTitle?: boolean
  width?: "narrow" | "default" | "wide"
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 sm:py-12",
        width === "narrow" && "max-w-3xl",
        width === "default" && "max-w-6xl",
        width === "wide" && "max-w-[1600px]",
        !pageModeTitle && "mh-page-tight",
        className
      )}
    >
      {title || actions ? (
        <header
          className={cn(
            "mb-8 flex flex-wrap items-end justify-between gap-4",
            !pageModeTitle && !actions && "mh-page-hide"
          )}
        >
          <div className={cn("min-w-0", !pageModeTitle && "mh-page-hide")}>
            {title ? (
              <h1 className="font-heading text-3xl font-bold tracking-tight uppercase sm:text-5xl">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      {children}
    </main>
  )
}

/** Small uppercase section label used across pages. */
export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "mb-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </h2>
  )
}
