import { describe, expect, it } from "vitest"

import { MODELS, parseSettings } from "@/generation/catalog"
import {
  PRESET_CATEGORIES,
  PRESET_SEED,
  upsertPresets,
} from "@/lib/preset-seed"

import { fakeDb } from "./fakes/mongo"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

describe("preset seed", () => {
  it("has 8 to 12 presets across video and image", () => {
    expect(PRESET_SEED.length).toBeGreaterThanOrEqual(8)
    expect(PRESET_SEED.length).toBeLessThanOrEqual(12)
    const surfaces = new Set(PRESET_SEED.map((p) => p.surface))
    expect(surfaces.has("video")).toBe(true)
    expect(surfaces.has("image")).toBe(true)
  })

  it("uses unique, valid slugs", () => {
    const slugs = PRESET_SEED.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(SLUG)
  })

  it("uses only installed models on the matching surface, with valid settings", () => {
    for (const preset of PRESET_SEED) {
      const model = MODELS.find((m) => m.id === preset.modelId)
      expect(model, `${preset.slug} -> ${preset.modelId}`).toBeDefined()
      if (!model) continue
      expect(model.surface).toBe(preset.surface)
      for (const key of Object.keys(preset.settings))
        expect(model.settings, `${preset.slug}.${key}`).toHaveProperty(key)
      expect(() => parseSettings(model, preset.settings)).not.toThrow()
    }
  })

  it("has no covers yet, known categories and a {subject} prompt", () => {
    const categories = new Set<string>(PRESET_CATEGORIES.map((c) => c.id))
    for (const preset of PRESET_SEED) {
      expect(preset.coverUrl).toBeUndefined()
      expect(categories.has(preset.category)).toBe(true)
      expect(preset.promptTemplate).toContain("{subject}")
      expect(
        `${preset.title} ${preset.description} ${preset.promptTemplate}`
      ).not.toMatch(/higgsfield/i)
    }
  })

  it("upserts idempotently by slug and keeps admin changes", async () => {
    const db = fakeDb({ presets: [["slug"]] })
    await upsertPresets(db as never)
    const collection = db.collection("presets")
    expect(collection.docs).toHaveLength(PRESET_SEED.length)

    const first = PRESET_SEED[0]!
    await collection.updateOne(
      { slug: first.slug },
      { $set: { active: false, coverUrl: "https://media.test/cover.mp4" } }
    )
    await upsertPresets(db as never)
    expect(collection.docs).toHaveLength(PRESET_SEED.length)
    const doc = await collection.findOne({ slug: first.slug })
    expect(doc).toMatchObject({
      title: first.title,
      active: false,
      coverUrl: "https://media.test/cover.mp4",
    })
  })
})
