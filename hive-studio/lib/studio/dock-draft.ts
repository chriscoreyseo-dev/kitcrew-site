import type { MediaItem } from "@/generation/catalog/types"

/** The dock's prompt, references and model, kept while the user signs in. The
    magic link usually opens a new tab, so this uses localStorage, not
    sessionStorage. It is restored once, then cleared; nothing auto-submits. */

const KEY = "hive.dockDraft.v1"
const MAX_AGE_MS = 60 * 60 * 1000

export type DockDraft = {
  prompt: string
  media: MediaItem[]
  modelId: string
  savedAt: number
}

export function saveDockDraft(draft: Omit<DockDraft, "savedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    /* private mode or quota: losing the draft is acceptable */
  }
}

export function takeDockDraft(now = Date.now()): DockDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)
    const draft = JSON.parse(raw) as Partial<DockDraft>
    if (
      typeof draft.prompt !== "string" ||
      !Array.isArray(draft.media) ||
      typeof draft.modelId !== "string" ||
      typeof draft.savedAt !== "number" ||
      now - draft.savedAt > MAX_AGE_MS
    )
      return null
    return draft as DockDraft
  } catch {
    return null
  }
}
