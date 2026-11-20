import type { PublicGenerationDTO } from "@/lib/community"

/** Load the published settings at click time. The prompt stays out of the URL. */
export function postRemixHref(
  item: Pick<PublicGenerationDTO, "surface" | "id">
) {
  return `/${item.surface}?from=${encodeURIComponent(item.id)}`
}

/** Recreate with my photos (S611, Chris): this video becomes the motion source
    and its prompt loads; the member adds a photo per person. Videos only. */
export function remixHref(item: Pick<PublicGenerationDTO, "id" | "kind">) {
  return item.kind === "video" ? `/video?remix=${item.id}` : null
}
