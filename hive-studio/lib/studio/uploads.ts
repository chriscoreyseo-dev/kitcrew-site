import { create } from "zustand"

import type { MediaKind } from "@/generation/catalog/types"
import { confirmUploadAction } from "@/generation/library-actions"
import { uploadMedia } from "@/generation/upload"
import { mediaKindFromMime } from "@/generation/upload-contract"

export type AssetKind = MediaKind

/** A durable, submit-ready media reference: `src` is a public URL the platform can fetch. */
export interface AssetSelection {
  id: string
  src: string
  kind: AssetKind
  name?: string
}

export interface AssetLibraryItem extends AssetSelection {
  source: "upload" | "generation"
  createdAt: number
}

type UploadsState = {
  items: AssetLibraryItem[]
  hydrate: (items: AssetLibraryItem[]) => void
  add: (item: AssetLibraryItem) => void
}

/** The user's uploaded references, loaded from MongoDB. */
export const useUploads = create<UploadsState>()((set) => ({
  items: [],
  hydrate: (items) => set({ items }),
  add: (item) =>
    set((s) => ({ items: [item, ...s.items.filter((i) => i.id !== item.id)] })),
}))

export function kindOf(file: File): AssetKind {
  return mediaKindFromMime(file.type)
}

/** Signed URL → PUT → confirm. Recorded only after the storage upload succeeds. */
export async function uploadAsset(file: File): Promise<AssetLibraryItem> {
  const { uploadId } = await uploadMedia(file)
  const result = await confirmUploadAction(uploadId, file.size, file.name)
  if (!result.ok) throw new Error(result.message)
  const item: AssetLibraryItem = { ...result.data, source: "upload" }
  useUploads.getState().add(item)
  return item
}
