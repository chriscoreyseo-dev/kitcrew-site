"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import { assertRecipesConfigured, recipeFor, savedRecipe } from "@/lib/ai/recipe"
import type { Recipe } from "@/lib/ai/recipe"
import { RateLimitedError, run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { requireUser } from "@/lib/auth-guard"
import {
  assertMediaOwned,
  GenerationInputError,
} from "@/lib/generations/lifecycle"
import { hit } from "@/lib/rate-limit"

const URL_IN = z.url({ protocol: /^https?$/ }).max(2048)

/** New recipes per member per day; a saved recipe is free and unlimited. */
const RECIPE_LIMIT = { max: 20, windowSec: 24 * 60 * 60 } as const

/** "Write the prompt for me" (S611): the recipe for a video the member may
    use (their own, a Community video, or a template's clip). */
export async function writeRecipeAction(
  videoUrl: unknown
): Promise<ActionResult<Recipe & { cached: boolean }>> {
  return run(async () => {
    const { userId } = await requireUser()
    const parsed = URL_IN.safeParse(videoUrl)
    if (!parsed.success) throw new GenerationInputError("Add a video first.")
    await assertMediaOwned(new ObjectId(userId), [parsed.data])
    const saved = await savedRecipe(parsed.data)
    if (saved) return { ...saved, cached: true }
    assertRecipesConfigured()
    const limit = await hit({ scope: "recipe", id: userId, ...RECIPE_LIMIT })
    if (!limit.ok)
      throw new RateLimitedError(
        "You've used the prompt writer a lot today. Try again tomorrow."
      )
    const { recipe, cached } = await recipeFor(parsed.data, userId)
    return { ...recipe, cached }
  })
}
