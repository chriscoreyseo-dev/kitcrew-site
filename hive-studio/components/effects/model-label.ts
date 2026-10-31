import { MODELS } from "@/generation/catalog"

/** Display label for a catalog model id; the id itself if it's not installed. */
export function modelLabel(modelId: string): string {
  return MODELS.find((m) => m.id === modelId)?.label ?? modelId
}

export function isInstalledModel(modelId: string): boolean {
  return MODELS.some((m) => m.id === modelId)
}
