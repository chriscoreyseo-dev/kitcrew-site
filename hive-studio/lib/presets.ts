import "server-only"

import type { ObjectId } from "mongodb"

import type { MediaRole, Surface } from "@/generation/catalog/types"
import { db } from "@/lib/db/mongo"

/** An input the effect brings with it (S611, Chris: a template "auto-loads"):
    e.g. the motion clip a Genjutsu template redraws with the member's photos.
    Our own media or https; served publicly and accepted on submit while the
    effect is active (lib/storage/media-access.ts, lib/generations/lifecycle.ts). */
export type PresetMedia = {
  role: MediaRole
  url: string
  kind: "image" | "video"
}

/** Effects ("presets"): a named recipe that opens a generator pre-filled.
    `promptTemplate` may contain `{subject}`; the generator shows it as the
    starting prompt, and `media` arrives already attached. Shared by /effects,
    the generator (?preset=) and /admin. */
export type PresetDoc = {
  _id: ObjectId
  slug: string
  title: string
  description?: string
  surface: Surface
  modelId: string
  promptTemplate: string
  settings: Record<string, unknown>
  /** Looping cover (video) or still; our own generated media (Phase 7). */
  coverUrl?: string
  /** Inputs that load with the effect; the member adds the rest. */
  media?: PresetMedia[]
  category: string
  order: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type PresetDTO = Omit<PresetDoc, "_id" | "createdAt" | "updatedAt"> & {
  id: string
}

export const presets = () => db().collection<PresetDoc>("presets")

export function toPresetDTO(p: PresetDoc): PresetDTO {
  const { _id, createdAt: _c, updatedAt: _u, ...rest } = p
  void _c
  void _u
  return { id: _id.toHexString(), ...rest }
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function getActivePreset(slug: string): Promise<PresetDTO | null> {
  if (!SLUG.test(slug)) return null
  try {
    const doc = await presets().findOne({ slug, active: true })
    return doc ? toPresetDTO(doc) : null
  } catch {
    // No database configured yet, or a blip: behave as "no such preset".
    return null
  }
}

/** Which of `urls` belong to an active effect's own media. */
export async function activePresetMediaUrls(
  urls: string[]
): Promise<Set<string>> {
  if (!urls.length) return new Set()
  const docs = await presets()
    .find(
      { active: true, "media.url": { $in: urls } },
      { projection: { media: 1 } }
    )
    .toArray()
  const wanted = new Set(urls)
  return new Set(
    docs.flatMap((d) => (d.media ?? []).map((m) => m.url)).filter((u) => wanted.has(u))
  )
}

export async function listActivePresets(
  category?: string
): Promise<PresetDTO[]> {
  try {
    const docs = await presets()
      .find({ active: true, ...(category ? { category } : {}) })
      .sort({ order: 1, title: 1 })
      .limit(200)
      .toArray()
    return docs.map(toPresetDTO)
  } catch {
    // Public pages still render (empty) before the database is configured.
    return []
  }
}

/** Community report on a published generation (moderation queue in /admin). */
export type ReportDoc = {
  _id: ObjectId
  generationId: ObjectId
  reporterId: ObjectId
  reason: "nsfw" | "copyright" | "hateful" | "spam" | "other"
  note?: string
  status: "open" | "dismissed" | "actioned"
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: ObjectId
}

export const reports = () => db().collection<ReportDoc>("reports")
