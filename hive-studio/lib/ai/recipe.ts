import "server-only"

import { z } from "zod"

import { db } from "@/lib/db/mongo"
import { env, requireEnv } from "@/lib/env"
import { GenerationInputError } from "@/lib/generations/lifecycle"
import { stillFrames } from "@/lib/media/ffmpeg"
import { mp4DurationSeconds } from "@/lib/media/mp4-duration"
import { signedMediaUrl } from "@/lib/storage/media-access"

/** The AI prompt writer (S611, Chris: "an AI that ... based on just seeing a
    video [writes] how it would recreate [it] ... having the two images or one
    image overlaid"). It watches still frames of a video and returns a recipe:
    how many photos it needs, a label for each photo slot, and a Genjutsu
    prompt that says which photo each person takes the look of. A recipe is
    written once per video and reused by everyone who recreates it. Runs on
    MarketHive's OpenAI proxy, the one AI Blog Autopilot uses. */

export type Recipe = {
  /** Photos the member should add, one per person. */
  people: number
  /** One label per photo, in order: "Man in front in the black suit". */
  slots: string[]
  prompt: string
}

const RECIPE = z
  .object({
    people: z.number().int().min(1).max(8),
    slots: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
    prompt: z.string().trim().min(20).max(4000),
  })
  .refine((r) => r.slots.length === r.people, "one slot per person")

type RecipeDoc = {
  /** The video's URL: one recipe per video. */
  _id: string
  recipe: Recipe
  model: string
  userId: string
  createdAt: Date
}

const recipes = () => db().collection<RecipeDoc>("recipes")

/** Proxy requests are capped at 256 KB (services/openai-proxy MAX_BODY_BYTES). */
const MAX_FRAME_BYTES = 200_000
const FRAMES = 6

export const RECIPE_SYSTEM = `You write prompts for Genjutsu, a motion-transfer video model. It keeps the exact motion, timing and camera of a source video and redraws the people in it with the look of reference photos a member uploads.

You are shown still frames from the source video, in order. Reply with JSON only:
{"people": <int>, "slots": [<string>, ...], "prompt": <string>}

- people: how many main on-screen people need a photo (1 to 8). Ignore crowds and passers-by.
- slots: one short label per person (max 8 words), in the order the member should add photos, telling the people apart by position, clothing or action, e.g. "Man in front in the black suit". Never names.
- prompt: 60 to 150 words. Describe the setting, lighting and camera, then each person's actions, and say which photo each one takes the look of: "the man in front ... has the face and look of photo 1", "the man behind with the boombox ... has the face and look of photo 2". Keep the original setting and motion. End with: "Keep every face true to its photo."
- Never names, brands, on-screen text, or anything sexual or violent.`

/** Asks the proxy's chat endpoint for a recipe from these frames. */
export async function askForRecipe(
  frames: string[],
  fetcher: typeof fetch = fetch
): Promise<Recipe> {
  const e = requireEnv("recipes")
  const body = JSON.stringify({
    model: e.RECIPE_MODEL,
    messages: [
      { role: "system", content: RECIPE_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `${frames.length} frames from the video, in order.` },
          ...frames.map((url) => ({
            type: "image_url",
            image_url: { url, detail: "low" },
          })),
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 3000,
    // Reasoning shares max_completion_tokens; uncapped, nano can spend it all
    // and answer "" (MarketHive S423/S597).
    reasoning_effort: "low",
  })
  const response = await fetcher(e.OPENAI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Auth": e.OPENAI_PROXY_TOKEN,
      "X-Proxy-Key": e.OPENAI_PROXY_KEY,
    },
    body,
    signal: AbortSignal.timeout(90_000),
  })
  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  } | null
  if (!response.ok) {
    console.warn(
      `[recipe] proxy ${response.status}: ${data?.error?.message ?? "no body"}`
    )
    throw new GenerationInputError(
      "The prompt writer couldn't read this video. Try again in a minute."
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "")
  } catch {
    parsed = null
  }
  const recipe = RECIPE.safeParse(parsed)
  if (!recipe.success)
    throw new GenerationInputError(
      "The prompt writer gave an unusable answer. Try again."
    )
  return recipe.data
}

/** Frames that fit the proxy's body cap, dropping evenly from the middle. */
export function fitFrames(frames: string[], max = MAX_FRAME_BYTES): string[] {
  const kept = [...frames]
  const size = () => kept.reduce((n, f) => n + f.length, 0)
  while (kept.length > 2 && size() > max) kept.splice(Math.floor(kept.length / 2), 1)
  return size() > max ? kept.slice(0, 1) : kept
}

/** Whether the proxy is set up; checked before any work so a member sees a
    plain message instead of "temporarily unavailable". */
export function assertRecipesConfigured(): void {
  const e = env()
  if (!e.OPENAI_PROXY_URL || !e.OPENAI_PROXY_TOKEN)
    throw new GenerationInputError(
      "The AI prompt writer isn't switched on here yet. Write the prompt yourself for now."
    )
}

/** A recipe already written for this video, if any (free to reuse). */
export async function savedRecipe(videoUrl: string): Promise<Recipe | null> {
  return (await recipes().findOne({ _id: videoUrl }))?.recipe ?? null
}

/** The recipe for `videoUrl`, written now unless one is saved. The caller has
    already checked the member may use this video. */
export async function recipeFor(
  videoUrl: string,
  userId: string
): Promise<{ recipe: Recipe; cached: boolean }> {
  const saved = await recipes().findOne({ _id: videoUrl })
  if (saved) return { recipe: saved.recipe, cached: true }

  assertRecipesConfigured()
  const source = signedMediaUrl(videoUrl)
  const seconds = await mp4DurationSeconds(source).catch(() => null)
  const frames = await stillFrames(source, seconds ?? 10, FRAMES)
  if (!frames?.length)
    throw new GenerationInputError(
      "We couldn't read frames from that video. Upload it as an MP4 and try again."
    )
  const recipe = await askForRecipe(fitFrames(frames))
  await recipes()
    .updateOne(
      { _id: videoUrl },
      {
        $setOnInsert: {
          recipe,
          model: requireEnv("recipes").RECIPE_MODEL,
          userId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
    .catch(() => undefined)
  return { recipe, cached: false }
}
