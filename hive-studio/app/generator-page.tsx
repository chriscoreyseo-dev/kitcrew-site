import { notFound } from "next/navigation"

import { MODELS, parseSettings } from "@/generation/catalog"
import type { MediaItem, Surface } from "@/generation/catalog"
import { GeneratorLayout } from "@/layouts/generator"
import { getPublicGeneration } from "@/lib/community"
import { getActivePreset } from "@/lib/presets"
import {
  MEDIA_FEED_TEMPLATES,
  TEMPLATE_MODEL,
} from "@/lib/media-feed-templates"
import { currentUser } from "@/lib/session"

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined

/** The prompt a "Recreate with my photos" opens with when the original has none. */
const REMIX_PROMPT =
  "Recreate this video with the people in my photos: the same moves, setting and camera, one photo per person."

/** Shared server entry for /image, /video, /audio: resolves ?model=, ?prompt=
    (Recreate), ?preset= (Effects, with any media they load) and ?remix=
    (Recreate with my photos: a published video becomes the motion source of
    the motion-transfer model, its prompt pre-filled; S611, Chris) into the
    composer's initial state. */
export async function GeneratorPage({
  surface,
  searchParams,
}: {
  surface: Surface
  searchParams: Promise<Search>
}) {
  const models = MODELS.filter((m) => m.surface === surface)
  if (!models.length) notFound()
  const params = await searchParams
  // Template and public-post links are self-contained drafts. Resolve them
  // before the legacy query options so mixed URLs cannot attach other media.
  if (params.template !== undefined || params.from !== undefined) {
    const template = MEDIA_FEED_TEMPLATES.find(
      (t) => t.slug === one(params.template)
    )
    const from = one(params.from)
    const [user, source] = await Promise.all([
      currentUser(),
      params.template === undefined && from ? getPublicGeneration(from) : null,
    ])
    let init
    let draftKey
    if (template && surface === "image") {
      init = {
        modelId: TEMPLATE_MODEL,
        prompt: template.prompt,
        settings: { aspectRatio: template.aspectRatio },
      }
      draftKey = template.slug
    } else if (source && source.surface === surface) {
      const original = models.find((m) => m.id === source.modelId)
      const model = original ?? models[0]!
      let settings = parseSettings(model, {})
      if (original) {
        // An older post can name an option the current catalog no longer offers.
        try {
          settings = parseSettings(model, source.settings)
        } catch {
          // Keep the current defaults and let the member edit them.
        }
      }
      init = {
        modelId: model.id,
        prompt: source.prompt.slice(0, 5000),
        settings,
      }
      draftKey = source.id
    } else {
      notFound()
    }
    return (
      <GeneratorLayout
        key={`${surface}:${draftKey}`}
        surface={surface}
        user={user ? { email: user.email } : null}
        init={init}
      />
    )
  }
  // The model that redraws a video's motion with the member's photos (Genjutsu).
  const motionModel =
    surface === "video"
      ? models.find(
          (m) =>
            m.requiredRoles?.includes("video") && (m.roles.reference ?? 0) > 0
        )
      : undefined
  const [user, preset, remixOf] = await Promise.all([
    currentUser(),
    one(params.preset)
      ? getActivePreset(one(params.preset)!)
      : Promise.resolve(null),
    motionModel && one(params.remix)
      ? getPublicGeneration(one(params.remix)!).catch(() => null)
      : Promise.resolve(null),
  ])
  const remix =
    remixOf?.kind === "video" && remixOf.urls[0] && motionModel
      ? { item: remixOf, model: motionModel }
      : null
  const usablePreset =
    preset &&
    preset.surface === surface &&
    models.some((m) => m.id === preset.modelId)
      ? preset
      : null
  const requested = one(params.model)
  // Animate: ?start=<url> opens the first video model that takes a start frame.
  const start = surface === "video" ? one(params.start) : undefined
  const startUrl =
    start && start.startsWith("https://") ? start.slice(0, 2048) : undefined
  const startModel = startUrl
    ? models.find((m) => (m.roles.start ?? 0) > 0)?.id
    : undefined
  const modelId =
    remix?.model.id ??
    usablePreset?.modelId ??
    (models.some((m) => m.id === requested) ? requested : undefined) ??
    startModel
  const prompt = remix
    ? remix.item.prompt.trim().slice(0, 5000) || REMIX_PROMPT
    : (usablePreset?.promptTemplate.replace(/\{subject\}/g, "").trim() ??
      one(params.prompt)?.slice(0, 5000))

  // The server accepts these on submit only if they are the user's own media,
  // a published creation, or an active effect's own media.
  const media: MediaItem[] = remix
    ? [
        {
          id: "remix",
          url: remix.item.urls[0]!,
          role: "video",
          kind: "video",
        },
      ]
    : [
        ...(usablePreset?.media ?? []).map((m, i) => ({
          id: `preset-${i}`,
          url: m.url,
          role: m.role,
          kind: m.kind,
        })),
        ...(startUrl && startModel
          ? [
              {
                id: "start",
                url: startUrl,
                role: "start" as const,
                kind: "image" as const,
              },
            ]
          : []),
      ]

  return (
    <GeneratorLayout
      key={`${surface}:${modelId ?? ""}:${usablePreset?.slug ?? ""}:${remix?.item.id ?? ""}`}
      surface={surface}
      user={user ? { email: user.email } : null}
      init={{
        ...(modelId ? { modelId } : {}),
        ...(prompt ? { prompt } : {}),
        ...(usablePreset && !remix ? { settings: usablePreset.settings } : {}),
        ...(media.length ? { media } : {}),
      }}
    />
  )
}
