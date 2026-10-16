"use client"

import { useFormatCredits } from "@/components/site/studio-mode"
import { Clock, Info, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { AuthDialog } from "@/components/auth/auth-dialog"
import { UpgradeDialog } from "@/components/billing/upgrade-dialog"
import { MediaSlots } from "@/components/generator/media-slots"
import { ModelCard } from "@/components/generator/model-picker"
import { SettingsRow } from "@/components/generator/settings-row"
import { UserGenerations } from "@/components/studio/user-generations"
import { Button } from "@/components/ui/button"
import { MODELS } from "@/generation/catalog"
import type { ModelEntry, Surface } from "@/generation/catalog"
import { useComposer } from "@/hooks/use-composer"
import { BRAND_TRIPTYCH } from "@/lib/brand-art"
import type { ComposerInit } from "@/hooks/use-composer"

type Mode = { id: string; label: string; models: ModelEntry[] }

/** Mode tabs come from the catalog; a tab exists only if it changes the list. */
function modesFor(surface: Surface, models: ModelEntry[]): Mode[] {
  if (surface !== "video") return [{ id: "create", label: "Create", models }]
  const motion = models.filter((m) => /motion/.test(m.id))
  const edit = models.filter((m) => (m.roles.source ?? 0) > 0)
  const create = models.filter((m) => !motion.includes(m) && !edit.includes(m))
  return [
    { id: "create", label: "Create Video", models: create },
    { id: "edit", label: "Edit Video", models: edit },
    { id: "motion", label: "Motion Control", models: motion },
  ].filter((mode) => mode.models.length > 0)
}

const COPY: Record<
  Surface,
  { headline: string; sub: string; steps: [string, string][] }
> = {
  video: {
    headline: "Make videos in one click",
    sub: "Pick a model, describe the shot, add a frame if you have one.",
    steps: [
      [
        "Add an image",
        "Drop a start frame or references, or skip it and just write.",
      ],
      [
        "Choose a model or effect",
        "Each model has its own look, speed and price.",
      ],
      [
        "Get your video",
        "It lands in your history and your library, ready to download.",
      ],
    ],
  },
  image: {
    headline: "Make images in one click",
    sub: "Describe it, pick a model, choose the shape.",
    steps: [
      [
        "Write a prompt",
        "Say what you want to see. Add references to steer the look.",
      ],
      [
        "Pick a model",
        "Portraits, design work, fast drafts: each model has a strength.",
      ],
      [
        "Get your images",
        "Download, reuse the settings, or animate one into video.",
      ],
    ],
  },
  audio: {
    headline: "Make sound in one click",
    sub: "Describe the sound, voice or music you need.",
    steps: [
      ["Describe it", "Voice, effects or music, in plain words."],
      ["Pick a model", "Choose the one that fits the job."],
      ["Get your audio", "Play it here and download it."],
    ],
  },
}

const EMPTY_IMAGES = BRAND_TRIPTYCH

export function GeneratorLayout({
  surface,
  user,
  init,
}: {
  surface: Surface
  user: { email: string } | null
  init?: ComposerInit
}) {
  // Model entries hold mapper functions, so they're resolved here, not passed from the server.
  const models = useMemo(
    () => MODELS.filter((m) => m.surface === surface),
    [surface]
  )
  const modes = useMemo(() => modesFor(surface, models), [surface, models])
  const initialMode =
    modes.find((m) => m.models.some((x) => x.id === init?.modelId)) ?? modes[0]!
  const [modeId, setModeId] = useState(initialMode.id)
  const mode = modes.find((m) => m.id === modeId) ?? modes[0]!
  const c = useComposer({ surface, models: mode.models, user, init })
  const fmt = useFormatCredits()
  const router = useRouter()
  const [canvas, setCanvas] = useState<"history" | "how">("history")
  const copy = COPY[surface]

  // Spans, not <ol>/<li>: the empty state renders its description inside a <p>.
  const steps = (inline: boolean) => {
    const Wrap = inline ? "span" : "ol"
    const Item = inline ? "span" : "li"
    return (
      <Wrap className="grid gap-3 text-left sm:grid-cols-3">
        {copy.steps.map(([title, body], i) => (
          <Item
            key={title}
            className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <span className="block font-mono text-xs text-primary">
              0{i + 1}
            </span>
            <span className="mt-2 block font-heading text-lg font-bold text-foreground uppercase">
              {title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {body}
            </span>
          </Item>
        ))}
      </Wrap>
    )
  }

  const generateLabel = c.quote
    ? `Generate ✦ ${fmt(c.quote.credits)}`
    : "Generate"

  return (
    <div className="flex flex-col pb-28 lg:h-[calc(100dvh-var(--header-h))] lg:flex-row lg:overflow-hidden lg:pb-0">
      {/* Control panel */}
      <aside className="flex w-full shrink-0 flex-col border-white/[0.06] lg:w-[400px] lg:border-r">
        <div className="flex flex-1 flex-col gap-5 p-4 lg:overflow-y-auto">
          {modes.length > 1 ? (
            <div
              role="tablist"
              aria-label="Mode"
              className="flex gap-1 rounded-xl bg-white/5 p-1"
            >
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={m.id === mode.id}
                  onClick={() => {
                    setModeId(m.id)
                    c.selectModel(m.models[0]!.id)
                  }}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground aria-selected:bg-white/10 aria-selected:text-foreground"
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          <ModelCard
            model={c.model}
            models={c.models}
            onSelect={c.selectModel}
            quoteOf={c.priced}
          />

          <MediaSlots
            model={c.model}
            roles={c.roles}
            media={c.media}
            library={c.libraryItems}
            onUpload={c.upload}
            onAdd={c.addMedia}
            onRemove={c.removeMedia}
          />

          <label className="flex flex-col gap-2">
            <span className="flex items-center justify-between text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Prompt
              <span className="font-mono tracking-normal normal-case">
                {c.prompt.length}/5000
              </span>
            </span>
            <textarea
              value={c.prompt}
              onChange={(e) => c.setPrompt(e.target.value.slice(0, 5000))}
              rows={5}
              placeholder={
                surface === "video"
                  ? "A slow push-in on a lighthouse at dusk, waves crashing, cinematic"
                  : surface === "image"
                    ? "Editorial portrait, soft window light, film grain"
                    : "Warm lo-fi beat with vinyl crackle"
              }
              className="min-h-28 resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-white/30"
            />
          </label>

          <SettingsRow
            model={c.model}
            values={c.settings}
            onChange={c.setSetting}
          />

          {c.error ? (
            <p role="alert" className="text-sm text-destructive">
              {c.error}
            </p>
          ) : null}
        </div>

        {/* Sticky footer: bottom bar on mobile, panel footer on desktop */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-white/[0.06] bg-background/90 p-3 backdrop-blur-xl lg:sticky lg:z-10 lg:p-4">
          {c.cancellable.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={c.cancelQueued}
              disabled={c.canceling}
            >
              {c.canceling
                ? "Cancelling…"
                : `Cancel queued (${c.cancellable.length})`}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => void c.generate()}
            disabled={!c.canGenerate}
            title={
              !c.canGenerate
                ? (c.prepared.error ?? "Write a prompt or add a reference")
                : undefined
            }
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-heading text-base font-bold text-primary-foreground uppercase transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles aria-hidden className="size-4" />
            {generateLabel}
          </button>
          {c.running.length ? (
            <p
              className="text-center text-xs text-muted-foreground"
              role="status"
            >
              {c.running.length} generating…
            </p>
          ) : null}
        </div>
      </aside>

      {/* Canvas */}
      <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col lg:min-h-0">
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-4 py-2">
          {(
            [
              ["history", "History", Clock],
              ["how", "How it works", Info],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={canvas === id}
              onClick={() => setCanvas(id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground aria-pressed:bg-white/10 aria-pressed:text-foreground"
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>
        {canvas === "how" ? (
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
            <h2 className="font-heading text-3xl font-bold uppercase sm:text-5xl">
              {copy.headline}
            </h2>
            {steps(false)}
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col px-4 pt-4">
            <UserGenerations
              items={c.galleryItems}
              emptyState={{
                images: EMPTY_IMAGES,
                title: (
                  <span className="font-heading text-3xl font-bold uppercase sm:text-5xl">
                    {copy.headline}
                  </span>
                ),
                description: (
                  <span className="flex flex-col gap-6">
                    <span>
                      {user ? copy.sub : `${copy.sub} Sign in to start.`}
                    </span>
                    {steps(true)}
                  </span>
                ),
              }}
              onDelete={(item) => void c.runs.remove(item.runId)}
              extraActions={{
                onReuse: (item) => c.reuse(item),
                onPublish: (item, value) => void c.publish(item.runId, value),
                ...(surface === "image"
                  ? {
                      onAnimate: (item) =>
                        router.push(
                          `/video?start=${encodeURIComponent(item.src)}&prompt=${encodeURIComponent(item.prompt)}`
                        ),
                    }
                  : {}),
              }}
            />
          </div>
        )}
      </section>

      <UpgradeDialog
        open={c.upgradeReason !== null}
        onOpenChange={(open) => !open && c.setUpgradeReason(null)}
        reason={c.upgradeReason ?? undefined}
      />
      <AuthDialog
        open={c.authReason !== null}
        onOpenChange={(open) => !open && c.setAuthReason(null)}
        reason={c.authReason ?? undefined}
      />
    </div>
  )
}
