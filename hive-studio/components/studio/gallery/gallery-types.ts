/** Data model for the justified-masonry feed. width/height only need the right ratio. */
export type MediaKind = "image" | "video" | "audio"
export type ItemStatus = "ready" | "generating" | "failed"

export interface GalleryItem {
  id: string
  /** Run this item belongs to (one video, or one of N images). */
  runId: string
  projectId?: string
  createdAt: number
  kind: MediaKind
  status: ItemStatus
  /** Still for images; poster (may be empty) for video; the file for audio. */
  src: string
  videoSrc?: string
  width: number
  height: number
  failureLabel?: string
  prompt: string
  alt: string
  modelLabel: string
  settings: Record<string, unknown>
  /** Catalog id, for Reuse / Animate. */
  modelId?: string
  /** Published to Community. */
  isPublic?: boolean
  groupId: string
  groupLabel: string
}

/** Optional per-tile actions beyond Download/Copy/Share/Delete. Each one
    appears only when its handler is passed (no inert buttons). */
export interface TileActions {
  onReuse?: (item: GalleryItem) => void
  onAnimate?: (item: GalleryItem) => void
  onPublish?: (item: GalleryItem, publish: boolean) => void
}

/** How near a tile is to the viewport — drives eager vs lazy loading. */
export type LoadTier = "full" | "near" | "far"
