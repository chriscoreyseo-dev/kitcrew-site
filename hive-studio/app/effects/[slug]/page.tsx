import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { ArrowLeft, Wand2 } from "lucide-react"

import { SettingsList } from "@/components/community/settings-list"
import { isInstalledModel, modelLabel } from "@/components/effects/model-label"
import { PresetCover } from "@/components/effects/preset-cover"
import { Page, SectionTitle } from "@/components/site/page"
import { buttonVariants } from "@/components/ui/button"
import { PRESET_CATEGORIES } from "@/lib/preset-seed"
import { getActivePreset } from "@/lib/presets"
import { cn } from "@/lib/utils"

type Params = { params: Promise<{ slug: string }> }

const load = cache(async (slug: string) => {
  const preset = await getActivePreset(slug)
  return preset && isInstalledModel(preset.modelId) ? preset : null
})

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const preset = await load(slug)
  if (!preset) return { title: "Not found · Hive Studio" }
  const title = `${preset.title} · Effects · Hive Studio`
  return {
    title,
    description: preset.description,
    openGraph: {
      title,
      description: preset.description,
      ...(preset.coverUrl && !/\.(mp4|webm|mov)(\?|$)/i.test(preset.coverUrl)
        ? { images: [{ url: preset.coverUrl }] }
        : {}),
    },
  }
}

/** Shows `{subject}` as a visible placeholder chip. */
function PromptTemplate({ text }: { text: string }) {
  const parts = text.split(/(\{subject\})/g)
  return (
    <p className="rounded-xl border border-white/10 bg-card p-4 text-sm leading-relaxed break-words text-muted-foreground">
      {parts.map((part, i) =>
        part === "{subject}" ? (
          <span
            key={i}
            className="mx-0.5 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-foreground"
          >
            your subject
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

export default async function EffectPage({ params }: Params) {
  const { slug } = await params
  const preset = await load(slug)
  if (!preset) notFound()
  const category =
    PRESET_CATEGORIES.find((c) => c.id === preset.category)?.label ??
    preset.category
  const surfaceLabel =
    preset.surface === "video"
      ? "Video"
      : preset.surface === "image"
        ? "Image"
        : "Audio"

  return (
    <Page width="wide">
      <Link
        href="/effects"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 -ml-2 text-muted-foreground"
        )}
      >
        <ArrowLeft aria-hidden />
        Effects
      </Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PresetCover
          slug={preset.slug}
          title={preset.title}
          surface={preset.surface}
          coverUrl={preset.coverUrl}
          className="aspect-video w-full rounded-2xl border border-white/10"
          large
        />
        <aside className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
              {surfaceLabel} · {category}
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight uppercase sm:text-4xl">
              {preset.title}
            </h1>
            {preset.description ? (
              <p className="text-sm text-muted-foreground sm:text-base">
                {preset.description}
              </p>
            ) : null}
          </div>

          <Link
            href={`/${preset.surface}?preset=${encodeURIComponent(preset.slug)}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 w-full text-base"
            )}
          >
            <Wand2 aria-hidden />
            Use effect
          </Link>

          <section>
            <SectionTitle>Model</SectionTitle>
            <p className="rounded-xl border border-white/10 bg-card px-4 py-3 text-sm">
              {modelLabel(preset.modelId)}
            </p>
          </section>

          <section>
            <SectionTitle>Starting prompt</SectionTitle>
            <PromptTemplate text={preset.promptTemplate} />
          </section>

          {Object.keys(preset.settings ?? {}).length ? (
            <section>
              <SectionTitle>Settings</SectionTitle>
              <SettingsList settings={preset.settings} />
            </section>
          ) : null}
        </aside>
      </div>
    </Page>
  )
}
