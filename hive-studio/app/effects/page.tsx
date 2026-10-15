import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { Wand2 } from "lucide-react"

import { EffectCard } from "@/components/effects/effect-card"
import { isInstalledModel } from "@/components/effects/model-label"
import { Page } from "@/components/site/page"
import { PRESET_CATEGORIES } from "@/lib/preset-seed"
import { listActivePresets } from "@/lib/presets"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Effects · Hive Studio",
  description:
    "Ready-made looks and camera moves. Pick one and the generator opens pre-filled.",
}

function categoryLabel(id: string) {
  const known = PRESET_CATEGORIES.find((c) => c.id === id)
  if (known) return known.label
  const text = id.replace(/[-_]+/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Chip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-white/30 bg-white/10 text-foreground"
          : "border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

export default async function EffectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  // Hide effects whose model isn't installed: they couldn't run.
  const all = (await listActivePresets()).filter((p) =>
    isInstalledModel(p.modelId)
  )
  const categories = [...new Set(all.map((p) => p.category))].sort((a, b) => {
    const ia = PRESET_CATEGORIES.findIndex((c) => c.id === a)
    const ib = PRESET_CATEGORIES.findIndex((c) => c.id === b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
  const requested =
    typeof params.category === "string" ? params.category : undefined
  const active =
    requested && categories.includes(requested) ? requested : undefined
  const shown = active ? all.filter((p) => p.category === active) : all

  return (
    <Page
      title="Effects"
      subtitle="Ready-made looks and camera moves. Pick one and the generator opens with the model, prompt and settings filled in."
      width="wide"
    >
      {all.length ? (
        <>
          {categories.length > 1 ? (
            <nav
              aria-label="Effect categories"
              className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              <Chip href="/effects" active={!active}>
                All
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c}
                  href={`/effects?category=${encodeURIComponent(c)}`}
                  active={active === c}
                >
                  {categoryLabel(c)}
                </Chip>
              ))}
            </nav>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <EffectCard key={p.id} preset={p} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/5">
            <Wand2 className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-bold uppercase">
              No effects yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              New effects are on the way. Check back soon.
            </p>
          </div>
        </div>
      )}
    </Page>
  )
}
