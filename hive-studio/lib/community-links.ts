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
