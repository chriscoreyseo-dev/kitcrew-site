"use server"

import { z } from "zod"

import { run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import {
  adjustCredits,
  assertRuleFitsModel,
  catalogModel,
  clearBillingFlag,
  clearModelPricing,
  createPreset,
  deletePreset,
  dismissReports,
  setModelEnabled,
  setModelPricing,
  setPresetActive,
  unpublishGeneration,
  updatePreset,
} from "@/lib/admin"
import type { PresetInput } from "@/lib/admin"
import { requireAdmin } from "@/lib/auth-guard"
import type { Credits } from "@/lib/billing/ledger"
import type { PriceRule } from "@/lib/billing/price"
import { GenerationInputError } from "@/lib/generations/lifecycle"
import { SLUG } from "@/lib/presets"

/** Admin-only mutations. Each one calls requireAdmin() first (a non-admin
    gets NOT_FOUND, same as a missing page) and validates input with zod. */

const OBJECT_ID = z.string().regex(/^[a-f0-9]{24}$/i)
const MODEL_ID = z.string().trim().min(1).max(100)
const SETTING_NAME = z.string().trim().min(1).max(64)

function parse<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : ""
    throw new GenerationInputError(`${message}${where}`)
  }
  return parsed.data
}

// ---------------------------------------------------------------- users

const ADJUST = z.object({
  userId: OBJECT_ID,
  delta: z
    .number()
    .int()
    .min(-10_000_000)
    .max(10_000_000)
    .refine((n) => n !== 0, "Delta can't be zero."),
  bucket: z.enum(["subscription", "topup"]),
  note: z.string().trim().min(1).max(300),
  /** Generated when the form renders; resubmitting it is a no-op. */
  token: z.uuid(),
})

export async function adminAdjustCreditsAction(
  input: unknown
): Promise<ActionResult<{ applied: boolean; credits: Credits }>> {
  return run(async () => {
    const { userId: adminId } = await requireAdmin()
    const data = parse(ADJUST, input, "Invalid adjustment.")
    return adjustCredits({ ...data, adminId })
  })
}

export async function adminClearBillingFlagAction(
  userId: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    await clearBillingFlag(parse(OBJECT_ID, userId, "User not found."))
    return null
  })
}

// --------------------------------------------------------------- models

const USD = z.number().finite().positive().max(1000)

const PRICE_RULE = z
  .object({
    base: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("per_run"), usd: USD }).strict(),
      z
        .object({
          kind: z.literal("per_image"),
          usd: USD,
          countSetting: SETTING_NAME.optional(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("per_second"),
          usd: USD,
          durationSetting: SETTING_NAME.optional(),
          defaultSeconds: z.number().finite().positive().max(3600),
        })
        .strict(),
      // S611: billed on an input video's measured seconds (Genjutsu).
      z
        .object({
          kind: z.literal("per_input_second"),
          usd: USD,
          role: z.enum(["video", "source"]),
          minSeconds: z.number().finite().positive().max(3600),
          maxSeconds: z.number().finite().positive().max(3600),
        })
        .strict()
        .refine((b) => b.minSeconds <= b.maxSeconds, {
          message: "minSeconds can't be more than maxSeconds.",
        }),
    ]),
    multipliers: z
      .record(
        SETTING_NAME,
        z.record(
          z.string().min(1).max(64),
          z.number().finite().positive().max(100)
        )
      )
      .optional(),
    // S611: a model's own markup over cost (1.3 = cost + 30%).
    markup: z.number().finite().min(1).max(10).optional(),
  })
  .strict() satisfies z.ZodType<PriceRule>

const SET_PRICING = z.object({
  modelId: MODEL_ID,
  /** null = explicitly unpriced. */
  rule: PRICE_RULE.nullable(),
  source: z.string().trim().max(200).optional(),
})

export async function adminSetModelPricingAction(
  input: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    const data = parse(SET_PRICING, input, "Invalid pricing rule.")
    const model = catalogModel(data.modelId)
    if (data.rule) assertRuleFitsModel(model, data.rule)
    await setModelPricing(model.id, data.rule, data.source || undefined)
    return null
  })
}

export async function adminClearModelPricingAction(
  modelId: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    const model = catalogModel(parse(MODEL_ID, modelId, "Unknown model."))
    await clearModelPricing(model.id)
    return null
  })
}

const SET_ENABLED = z.object({ modelId: MODEL_ID, enabled: z.boolean() })

export async function adminSetModelEnabledAction(
  input: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    const data = parse(SET_ENABLED, input, "Invalid request.")
    const model = catalogModel(data.modelId)
    await setModelEnabled(model.id, data.enabled)
    return null
  })
}

// -------------------------------------------------------------- presets

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

const PRESET = z.object({
  slug: z.string().trim().min(1).max(64).regex(SLUG, "Invalid slug."),
  title: z.string().trim().min(1).max(80),
  description: optionalText(300),
  surface: z.enum(["image", "video", "audio"]),
  modelId: MODEL_ID,
  promptTemplate: z.string().trim().min(1).max(2000),
  settings: z.record(SETTING_NAME, z.unknown()).default({}),
  coverUrl: z
    .union([z.literal(""), z.url({ protocol: /^https$/ }).max(2000)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Inputs the effect loads, e.g. a Genjutsu template's motion clip (S611).
  media: z
    .array(
      z.object({
        role: z.enum(["start", "end", "reference", "video", "audio", "source"]),
        url: z.url({ protocol: /^https$/ }).max(2000),
        kind: z.enum(["image", "video"]),
      })
    )
    .max(9)
    .optional()
    .transform((v) => (v?.length ? v : undefined)),
  category: z.string().trim().min(1).max(40),
  order: z.number().int().min(-10_000).max(10_000).default(0),
  active: z.boolean().default(false),
}) satisfies z.ZodType<PresetInput, unknown>

export async function adminCreatePresetAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    await requireAdmin()
    const data = parse(PRESET, input, "Invalid effect.")
    return { id: await createPreset(data) }
  })
}

export async function adminUpdatePresetAction(
  id: unknown,
  input: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    const presetId = parse(OBJECT_ID, id, "Effect not found.")
    await updatePreset(presetId, parse(PRESET, input, "Invalid effect."))
    return null
  })
}

const SET_ACTIVE = z.object({ id: OBJECT_ID, active: z.boolean() })

export async function adminSetPresetActiveAction(
  input: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    const data = parse(SET_ACTIVE, input, "Effect not found.")
    await setPresetActive(data.id, data.active)
    return null
  })
}

export async function adminDeletePresetAction(
  id: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireAdmin()
    await deletePreset(parse(OBJECT_ID, id, "Effect not found."))
    return null
  })
}

// ----------------------------------------------------------- moderation

export async function adminDismissReportsAction(
  generationId: unknown
): Promise<ActionResult<{ dismissed: number }>> {
  return run(async () => {
    const { userId: adminId } = await requireAdmin()
    const id = parse(OBJECT_ID, generationId, "Report not found.")
    return { dismissed: await dismissReports(id, adminId) }
  })
}

export async function adminUnpublishGenerationAction(
  generationId: unknown
): Promise<ActionResult<{ actioned: number }>> {
  return run(async () => {
    const { userId: adminId } = await requireAdmin()
    const id = parse(OBJECT_ID, generationId, "Generation not found.")
    return unpublishGeneration(id, adminId)
  })
}
