/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { CommunityTile } from "@/components/community/community-tile"
import { EffectCard } from "@/components/effects/effect-card"
import { SectionTitle } from "@/components/site/page"
import { MODELS } from "@/generation/catalog"
import { modelMeta } from "@/generation/catalog/metadata"
import { BRAND } from "@/lib/brand"
import { listPublicGenerations } from "@/lib/community"
import type { PublicGenerationDTO } from "@/lib/community"
import { listActivePresets } from "@/lib/presets"

/** Featured models, in order, when installed. */
const FEATURED = [
  "seedance-2.5",
  "kling-3-pro",
  "soul-2",
  "flux-2",
  "wan-3",
  "z-image-turbo",
]

const GLOW =
  "radial-gradient(60% 80% at 50% 0%, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)"
const DOTS = "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)"
const DOTS_MASK =
  "radial-gradient(55% 70% at 50% 0%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 75%)"

export default async function ExplorePage() {
  const featured = FEATURED.map((id) => MODELS.find((m) => m.id === id)).filter(
    (m): m is (typeof MODELS)[number] => Boolean(m)
  )
  const installed = new Set(MODELS.map((m) => m.id))
  const [effects, community] = await Promise.all([
    listActivePresets().then((list) =>
      list.filter((p) => installed.has(p.modelId)).slice(0, 8)
    ),
    listPublicGenerations(null, 12)
      .then((page) => page.items)
      .catch((): PublicGenerationDTO[] => []),
  ])

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 text-center sm:pt-28 sm:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: GLOW }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: DOTS,
            backgroundSize: "22px 22px",
            maskImage: DOTS_MASK,
            WebkitMaskImage: DOTS_MASK,
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {BRAND.name}
          </p>
          <h1 className="mt-4 font-heading text-5xl leading-[0.95] font-bold tracking-tight uppercase sm:text-7xl lg:text-8xl">
            Every top AI model.
            <br />
            One studio.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Make video, images and sound with the best generative models, pay as
            you go with credits, and keep everything in one library.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/video"
              className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-heading font-bold text-primary-foreground uppercase hover:bg-primary/85"
            >
              Create video <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/image"
              className="flex h-12 items-center rounded-xl border border-ink/15 px-6 font-heading font-bold uppercase hover:bg-ink/5"
            >
              Create image
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-20 sm:px-6">
        {/* Featured models */}
        <section>
          <SectionTitle>Top models</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((m) => {
              const meta = modelMeta(m.id)
              return (
                <Link
                  key={m.id}
                  href={`/${m.surface}?model=${m.id}`}
                  className="group relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-br from-ink/[0.07] to-transparent p-5 transition-colors hover:border-ink/25"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                      {m.surface} · {meta?.provider}
                    </span>
                    {m.icon ? (
                      <img
                        src={`/model-icons/${m.icon}.svg`}
                        alt=""
                        aria-hidden
                        className="size-6"
                      />
                    ) : null}
                  </span>
                  <span className="pr-8">
                    <span className="block font-heading text-2xl font-bold uppercase">
                      {m.label}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {meta?.bestFor ?? meta?.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="absolute right-5 bottom-5 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                  />
                </Link>
              )
            })}
          </div>
        </section>

        {/* Effects */}
        {effects.length ? (
          <section>
            <div className="flex items-baseline justify-between">
              <SectionTitle>Effects</SectionTitle>
              <Link
                href="/effects"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                All effects
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {effects.map((p) => (
                <EffectCard key={p.id} preset={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Community teaser */}
        <section>
          <div className="flex items-baseline justify-between">
            <SectionTitle>From the community</SectionTitle>
            <Link
              href="/community"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              See more from the community
            </Link>
          </div>
          {community.length ? (
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3">
              {community.map((item) => (
                <CommunityTile key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-ink/10 p-6 text-sm text-muted-foreground">
              Nothing shared yet. Publish a generation from your library to be
              first.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
