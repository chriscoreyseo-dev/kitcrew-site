import type { PublicGenerationDTO } from "@/lib/community"

/** Opens the generator with this creation's model and prompt (Recreate). */
export function recreateHref(
  item: Pick<PublicGenerationDTO, "modelId" | "prompt" | "surface">
) {
  const qs = new URLSearchParams({
    model: item.modelId,
    prompt: item.prompt.slice(0, 2000),
  })
  return `/${item.surface}?${qs.toString()}`
}

/** Recreate with my photos (S611, Chris): this video becomes the motion source
    and its prompt loads; the member adds a photo per person. Videos only. */
export function remixHref(item: Pick<PublicGenerationDTO, "id" | "kind">) {
  return item.kind === "video" ? `/video?remix=${item.id}` : null
}
