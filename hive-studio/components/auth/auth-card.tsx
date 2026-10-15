import type { ReactNode } from "react"

import { BRAND } from "@/lib/brand"

/** Centered card used by the /login pages. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
        <p className="mb-6 text-sm font-bold tracking-widest text-primary uppercase">
          {BRAND.name}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight uppercase">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 text-sm text-muted-foreground">
            {description}
          </div>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </main>
  )
}
