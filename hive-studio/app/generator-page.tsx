import { notFound } from "next/navigation"

import { MODELS } from "@/generation/catalog"
import type { Surface } from "@/generation/catalog"
import { GeneratorLayout } from "@/layouts/generator"
import { getActivePreset } from "@/lib/presets"
import { currentUser } from "@/lib/session"

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined

/** Shared server entry for /image, /video, /audio: resolves ?model=, ?prompt=
    (Recreate) and ?preset= (Effects) into the composer's initial state. */
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
  const [user, preset] = await Promise.all([
    currentUser(),
    one(params.preset)
      ? getActivePreset(one(params.preset)!)
      : Promise.resolve(null),
  ])
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
    usablePreset?.modelId ??
    (models.some((m) => m.id === requested) ? requested : undefined) ??
    startModel
  const prompt =
    usablePreset?.promptTemplate.replace(/\{subject\}/g, "").trim() ??
    one(params.prompt)?.slice(0, 5000)

  return (
    <GeneratorLayout
      key={`${surface}:${modelId ?? ""}:${usablePreset?.slug ?? ""}`}
      surface={surface}
      user={user ? { email: user.email } : null}
      init={{
        ...(modelId ? { modelId } : {}),
        ...(prompt ? { prompt } : {}),
        ...(usablePreset ? { settings: usablePreset.settings } : {}),
        // The server accepts it on submit only if it's the user's own media.
        ...(startUrl && startModel
          ? {
              media: [
                {
                  id: "start",
                  url: startUrl,
                  role: "start" as const,
                  kind: "image" as const,
                },
              ],
            }
          : {}),
      }}
    />
  )
}
