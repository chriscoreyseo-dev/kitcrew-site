import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { ArrowLeft, AudioLines, Repeat2 } from "lucide-react"

import { CaptionEditor } from "@/components/community/caption-editor"
import { ReportDialog } from "@/components/community/report-dialog"
import { SettingsList } from "@/components/community/settings-list"
import { UnpublishButton } from "@/components/community/unpublish-button"
import { Page, SectionTitle } from "@/components/site/page"
import { buttonVariants } from "@/components/ui/button"
import { getPublicGeneration, isPublicOwner } from "@/lib/community"
import type { PublicGenerationDTO } from "@/lib/community"
import { recreateHref } from "@/lib/community-links"
import { currentUser } from "@/lib/session"
import { cn } from "@/lib/utils"

type Params = { params: Promise<{ id: string }> }

const load = cache(async (id: string) =>
  getPublicGeneration(id).catch((error: unknown) => {
    console.error("[community] detail failed", error)
    return null
  })
)

function shortPrompt(prompt: string, max = 70) {
  const text = prompt.replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const item = await load(id)
  if (!item) return { title: "Not found · Hive Studio" }
  const title = `${shortPrompt(item.prompt) || item.modelLabel} · Hive Studio`
  const description = `Made with ${item.modelLabel} on Hive Studio.`
  const image = item.kind === "image" ? item.urls[0] : undefined
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

/** Generator deep link; the generator pages read `model` and `prompt`. */
function Media({
  kind,
  url,
  aspect,
  alt,
  large,
}: {
  kind: PublicGenerationDTO["kind"]
  url: string
  aspect: number
  alt: string
  large?: boolean
}) {
  if (kind === "audio")
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-ink/10 bg-gradient-to-br from-ink/10 to-ink/[0.02] p-8">
        <AudioLines className="size-10 text-muted-foreground" aria-hidden />
        <audio src={url} controls className="w-full max-w-xl" />
      </div>
    )
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl border border-ink/10 bg-card"
      style={{
        aspectRatio: a,
        maxWidth: large ? `calc(72svh * ${a})` : undefined,
      }}
    >
      {kind === "video" ? (
        <video
          src={url}
          controls
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          className="absolute inset-0 size-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user media on R2, fixed aspect box
        <img
          src={url}
          alt={alt}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-contain"
        />
      )}
    </div>
  )
}

export default async function GenerationPage({ params }: Params) {
  const { id } = await params
  const item = await load(id)
  if (!item) notFound()

  const user = await currentUser()
  const owner = user
    ? await isPublicOwner(id, user.id).catch(() => false)
    : false
  const [first, ...rest] = item.urls
  const alt = shortPrompt(item.prompt, 120) || item.modelLabel
  const published = new Date(item.publishedAt)

  return (
    <Page width="wide">
      <Link
        href="/community"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 -ml-2 text-muted-foreground"
        )}
      >
        <ArrowLeft aria-hidden />
        Community
      </Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          {first ? (
            <Media
              kind={item.kind}
              url={first}
              aspect={item.aspect}
              alt={alt}
              large
            />
          ) : null}
          {rest.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rest.map((url) => (
                <Media
                  key={url}
                  kind={item.kind}
                  url={url}
                  aspect={item.aspect}
                  alt={alt}
                />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-2xl font-bold uppercase">
              {item.modelLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              By {item.author} ·{" "}
              <time dateTime={published.toISOString()}>
                {published.toLocaleDateString("en", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </p>
          </div>

          {item.caption || owner ? (
            <div className="text-sm">
              <CaptionEditor id={item.id} caption={item.caption} mine={owner} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={recreateHref(item)}
              className={cn(buttonVariants({ size: "lg" }), "px-5")}
            >
              <Repeat2 aria-hidden />
              Recreate
            </Link>
            {owner ? (
              <UnpublishButton generationId={item.id} />
            ) : user ? (
              <ReportDialog generationId={item.id} />
            ) : (
              <Link
                href={`/login?next=/g/${item.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "text-muted-foreground"
                )}
              >
                Sign in to report
              </Link>
            )}
          </div>

          {item.prompt ? (
            <section>
              <SectionTitle>Prompt</SectionTitle>
              <p className="rounded-xl border border-ink/10 bg-card p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {item.prompt}
              </p>
            </section>
          ) : null}

          {Object.keys(item.settings).length ? (
            <section>
              <SectionTitle>Settings</SectionTitle>
              <SettingsList settings={item.settings} />
            </section>
          ) : null}
        </aside>
      </div>
    </Page>
  )
}
