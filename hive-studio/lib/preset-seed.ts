import type { Db } from "mongodb"

import type { Surface } from "@/generation/catalog/types"

/** Starter effects. Pure data plus an idempotent upsert, with no
    `server-only` import so `scripts/seed-presets.ts` can run it under tsx.
    Covers are left undefined: Phase 7 generates our own; the UI shows a
    gradient placeholder until then. Model ids must exist in
    generation/catalog/models (tests/presets.test.ts checks). */

export type PresetSeed = {
  slug: string
  title: string
  description: string
  surface: Surface
  modelId: string
  promptTemplate: string
  settings: Record<string, unknown>
  coverUrl?: string
  category: string
  order: number
}

export const PRESET_CATEGORIES = [
  { id: "cinematic", label: "Cinematic" },
  { id: "motion", label: "Motion" },
  { id: "portrait", label: "Portrait" },
  { id: "product", label: "Product" },
  { id: "art", label: "Art" },
] as const

export const PRESET_SEED: PresetSeed[] = [
  {
    slug: "slow-dolly-reveal",
    title: "Slow Dolly Reveal",
    description:
      "The camera glides forward through foreground detail and settles on your subject, like the opening shot of a film.",
    surface: "video",
    modelId: "seedance-2.5",
    promptTemplate:
      "Slow forward dolly through soft foreground haze, revealing {subject} in the center of frame, shallow depth of field, warm practical lights, cinematic grade",
    settings: { aspectRatio: "16:9", duration: 5, resolution: "720p" },
    category: "cinematic",
    order: 10,
  },
  {
    slug: "golden-hour-orbit",
    title: "Golden Hour Orbit",
    description:
      "A smooth half orbit around your subject as low sun flares across the lens.",
    surface: "video",
    modelId: "kling-3-pro",
    promptTemplate:
      "Smooth 180 degree orbit around {subject} at golden hour, low sun flaring through the lens, long shadows, gentle breeze, filmic contrast",
    settings: { aspectRatio: "16:9", duration: 5 },
    category: "cinematic",
    order: 20,
  },
  {
    slug: "neon-rain-chase",
    title: "Neon Rain Chase",
    description:
      "Handheld energy on a rain-soaked night street, with reflections in every puddle.",
    surface: "video",
    modelId: "wan-3",
    promptTemplate:
      "Handheld tracking shot following {subject} down a rain-soaked night street, neon signs reflecting in puddles, light motion blur, moody teal and magenta",
    settings: { aspectRatio: "16:9", duration: 5, resolution: "720p" },
    category: "cinematic",
    order: 30,
  },
  {
    slug: "levitate",
    title: "Levitate",
    description:
      "Your subject lifts gently off the ground while dust and small objects drift upward around it.",
    surface: "video",
    modelId: "seedance-2",
    promptTemplate:
      "{subject} slowly lifts off the ground and hovers, dust particles and small objects floating upward around it, calm and dreamlike, steady camera",
    settings: { aspectRatio: "9:16", duration: 5, resolution: "720p" },
    category: "motion",
    order: 40,
  },
  {
    slug: "paper-unfold",
    title: "Paper Unfold",
    description:
      "A flat paper cut-out folds open into a fully three-dimensional scene.",
    surface: "video",
    modelId: "minimax-hailuo-2.3",
    promptTemplate:
      "A flat paper cut-out of {subject} unfolds and pops up into a full three-dimensional paper diorama, crisp folds, soft studio light, playful stop-motion feel",
    settings: { aspectRatio: "1:1", duration: 5, resolution: "720p" },
    category: "motion",
    order: 50,
  },
  {
    slug: "product-turntable",
    title: "Product Turntable",
    description: "A clean studio spin that shows your product from every side.",
    surface: "video",
    modelId: "kling-2.6",
    promptTemplate:
      "{subject} rotating slowly on a seamless studio turntable, soft key light with a gentle rim, subtle reflection on the floor, clean commercial look",
    settings: { aspectRatio: "1:1", duration: 5, resolution: "720p" },
    category: "product",
    order: 60,
  },
  {
    slug: "editorial-portrait",
    title: "Editorial Portrait",
    description:
      "Magazine-cover lighting with natural skin texture and a calm, confident pose.",
    surface: "image",
    modelId: "soul-2",
    promptTemplate:
      "Editorial portrait of {subject}, soft window light from the side, natural skin texture, muted wardrobe, plain backdrop, 85mm look, magazine cover composition",
    settings: { aspectRatio: "3:4" },
    category: "portrait",
    order: 70,
  },
  {
    slug: "film-still-35mm",
    title: "35mm Film Still",
    description:
      "Grain, halation and slightly lifted blacks, as if pulled from a roll of film.",
    surface: "image",
    modelId: "soul-cinema",
    promptTemplate:
      "35mm film still of {subject}, visible grain, gentle halation around highlights, lifted blacks, candid framing, late afternoon light",
    settings: { aspectRatio: "16:9" },
    category: "portrait",
    order: 80,
  },
  {
    slug: "floating-product",
    title: "Floating Product",
    description:
      "Your product suspended mid-air among a few matching props, lit like a campaign shot.",
    surface: "image",
    modelId: "flux-2",
    promptTemplate:
      "{subject} floating in mid-air surrounded by a few matching props, colored seamless background, crisp studio lighting with soft shadow below, high-end advertising photo",
    settings: { aspectRatio: "3:4" },
    category: "product",
    order: 90,
  },
  {
    slug: "miniature-world",
    title: "Miniature World",
    description: "Tilt-shift focus turns any place into a tiny handmade model.",
    surface: "image",
    modelId: "z-image-turbo",
    promptTemplate:
      "Tilt-shift miniature diorama of {subject}, tiny handmade details, very shallow focus band, bright daylight, saturated toy-like colors",
    settings: { aspectRatio: "16:9" },
    category: "art",
    order: 100,
  },
  {
    slug: "risograph-poster",
    title: "Risograph Poster",
    description:
      "Two-ink print texture with slight misregistration and bold flat shapes.",
    surface: "image",
    modelId: "recraft-4.1",
    promptTemplate:
      "Risograph style poster of {subject}, two spot colors, coarse print grain, slight misregistration, bold flat shapes, generous negative space",
    settings: { aspectRatio: "3:4" },
    category: "art",
    order: 110,
  },
  {
    slug: "clay-character",
    title: "Clay Character",
    description:
      "A soft hand-sculpted clay figure with fingerprints and warm studio light.",
    surface: "image",
    modelId: "qwen-image-3",
    promptTemplate:
      "{subject} as a hand-sculpted clay figure, visible fingerprints and tool marks, soft warm studio light, pastel backdrop, playful stop-motion character design",
    settings: { aspectRatio: "1:1" },
    category: "art",
    order: 120,
  },
]

type PresetWrite = PresetSeed & {
  active: boolean
  createdAt: Date
  updatedAt: Date
}

/** Upsert every seed by slug. Content fields are refreshed on each run;
    `active`, `createdAt` (and any cover set later) are only set on insert,
    so an admin's toggles and Phase 7 covers survive a re-seed. */
export async function upsertPresets(
  database: Pick<Db, "collection">,
  seeds: PresetSeed[] = PRESET_SEED,
  now = new Date()
): Promise<number> {
  const collection = database.collection<PresetWrite>("presets")
  for (const seed of seeds) {
    const { coverUrl, ...content } = seed
    await collection.updateOne(
      { slug: seed.slug },
      {
        $set: { ...content, updatedAt: now },
        $setOnInsert: {
          active: true,
          createdAt: now,
          ...(coverUrl ? { coverUrl } : {}),
        },
      },
      { upsert: true }
    )
  }
  return seeds.length
}
