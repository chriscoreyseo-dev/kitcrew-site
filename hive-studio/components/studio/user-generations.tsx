"use client"

import type { ReactNode } from "react"

import { JustifiedGallery } from "./gallery/justified-gallery"
import type { GalleryItem, TileActions } from "./gallery/gallery-types"
import type { ScreenEmptyStateContent } from "./screen-empty-state"

/**
 * UserGenerations — THE component for any browsable feed of the current user's
 * own generations. Everything the feed needs (virtualized justified gallery,
 * hover actions, the detail lightbox, generating/failed tiles, density control,
 * infinite scroll) lives inside; screens render this, never the gallery folder.
 */
export interface UserGenerationsProps {
  items: GalleryItem[]
  title?: ReactNode
  emptyState: ScreenEmptyStateContent
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void | Promise<unknown>
  onDelete?: (item: GalleryItem) => void
  /** Reuse / Animate / Publish on each tile, when handlers are given. */
  extraActions?: TileActions
  /** Below 1024px the page scrolls the feed, not a box of its own (S611). */
  pageScrollBelowLg?: boolean
}

export function UserGenerations(props: UserGenerationsProps) {
  return <JustifiedGallery grouped={false} {...props} />
}
