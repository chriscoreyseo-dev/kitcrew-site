import "server-only"

import { MongoServerError, ObjectId } from "mongodb"

import { MODELS, parseSettings } from "@/generation/catalog"
import type { ModelEntry, Surface } from "@/generation/catalog/types"
import { applyLedgerEntry, creditsOf } from "@/lib/billing/ledger"
import type {
  Bucket,
  Credits,
  LedgerEntry,
  LedgerReason,
} from "@/lib/billing/ledger"
import { priceFor } from "@/lib/billing/price"
import type { PriceRule, Quote } from "@/lib/billing/price"
import {
  effectivePricing,
  priceConfig,
  resetPricingCache,
} from "@/lib/billing/pricing"
import type { ModelPricingDoc } from "@/lib/billing/pricing"
import { PRICING_TABLE } from "@/lib/billing/pricing-table"
import { db } from "@/lib/db/mongo"
import { GenerationInputError } from "@/lib/generations/lifecycle"
import type {
  GenerationDoc,
  GenerationOutput,
  GenerationStatus,
} from "@/lib/generations/model"
import { presets, reports } from "@/lib/presets"
import type { PresetDoc, ReportDoc } from "@/lib/presets"
import type { Role } from "@/types/next-auth"
import { isMarketHive } from "@/lib/mode"

/** Admin queries and writes. Every caller has already passed requireAdmin();
    this module never checks roles itself. Nothing here returns hfRequestId. */

type UserDoc = {
  _id: ObjectId
  email?: string | null
  name?: string | null
  role?: Role
  plan?: string
  credits?: Partial<Credits>
  billingFlag?: string
  createdAt?: Date
}

const users = () => db().collection<UserDoc>("users")
const ledger = () => db().collection<LedgerEntry>("credit_ledger")
const generations = () => db().collection<GenerationDoc>("generations")
const modelPricing = () => db().collection<ModelPricingDoc>("model_pricing")

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function oid(id: string, what: string): ObjectId {
  if (!/^[a-f0-9]{24}$/i.test(id))
    throw new GenerationInputError(`${what} not found.`)
  return new ObjectId(id)
}

function isDuplicate(error: unknown): boolean {
  return error instanceof MongoServerError
    ? error.code === 11000
    : (error as { code?: unknown })?.code === 11000
}

// ---------------------------------------------------------------- users

export type AdminUserRow = {
  id: string
  email: string
  name?: string
  role: Role
  plan: string
  credits: Credits
  billingFlag?: string
  createdAt: string | null
}

export type AdminLedgerRow = {
  id: string
  delta: number
  bucket: Bucket
  reason: LedgerReason
  refType: string
  note?: string
  balanceAfter: number
  createdAt: string
}

function toUserRow(u: UserDoc): AdminUserRow {
  return {
    id: u._id.toHexString(),
    email: u.email ?? "",
    ...(u.name ? { name: u.name } : {}),
    role: u.role === "admin" ? "admin" : "user",
    plan: u.plan ?? "free",
    credits: creditsOf(u),
    ...(u.billingFlag ? { billingFlag: u.billingFlag } : {}),
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
  }
}

const USER_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  plan: 1,
  credits: 1,
  billingFlag: 1,
  createdAt: 1,
} as const

/** Case-insensitive email prefix search; newest accounts when `query` is empty. */
export async function searchUsers(
  query: string,
  limit = 50
): Promise<AdminUserRow[]> {
  const q = query.trim().slice(0, 254)
  const filter = q
    ? { email: { $regex: `^${escapeRegex(q)}`, $options: "i" } }
    : {}
  const docs = await users()
    .find(filter, { projection: USER_FIELDS })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return docs.map(toUserRow)
}

export async function getUserRow(id: string): Promise<AdminUserRow | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null
  const doc = await users().findOne(
    { _id: new ObjectId(id) },
    { projection: USER_FIELDS }
  )
  return doc ? toUserRow(doc) : null
}

export async function recentLedger(
  userId: string,
  limit = 20
): Promise<AdminLedgerRow[]> {
  if (!/^[a-f0-9]{24}$/i.test(userId)) return []
  const docs = await ledger()
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return docs.map((e) => ({
    id: `${e.reason}:${e.refType}:${e.refId}`,
    delta: e.delta,
    bucket: e.bucket,
    reason: e.reason,
    refType: e.refType,
    ...(e.note ? { note: e.note } : {}),
    balanceAfter: e.balanceAfter,
    createdAt: e.createdAt.toISOString(),
  }))
}

/** Signed credit adjustment, idempotent on `token` (the ledger's unique
    {reason, refType, refId}). The ledger clamps the bucket at zero. */
export async function adjustCredits(input: {
  adminId: string
  userId: string
  delta: number
  bucket: Bucket
  note: string
  token: string
}): Promise<{ applied: boolean; credits: Credits }> {
  // markethive mode: balances live in MarketHive's wallet, not this ledger.
  if (isMarketHive())
    throw new GenerationInputError(
      "Credits are managed in MarketHive for this studio."
    )
  const userId = oid(input.userId, "User")
  const exists = await users().findOne({ _id: userId })
  if (!exists) throw new GenerationInputError("User not found.")
  const applied = await applyLedgerEntry({
    userId,
    delta: input.delta,
    bucket: input.bucket,
    reason: "admin_adjust",
    refType: "admin",
    refId: input.token,
    note: `${input.note} (by ${input.adminId})`,
  })
  return { applied, credits: creditsOf(await users().findOne({ _id: userId })) }
}

export async function clearBillingFlag(userId: string): Promise<void> {
  const result = await users().updateOne(
    { _id: oid(userId, "User") },
    { $unset: { billingFlag: "" } }
  )
  if (!result.matchedCount) throw new GenerationInputError("User not found.")
}

// ---------------------------------------------------------- generations

export const GENERATIONS_PAGE_SIZE = 50

export type AdminGenerationRow = {
  id: string
  userId: string
  email: string | null
  modelId: string
  modelLabel: string
  surface: Surface
  status: GenerationStatus
  cost: number
  error?: string
  prompt: string
  outputs: Pick<GenerationOutput, "kind" | "url">[]
  isPublic: boolean
  createdAt: string
}

async function emailsFor(ids: ObjectId[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const docs = await users()
    .find({ _id: { $in: ids } }, { projection: { email: 1 } })
    .toArray()
  return new Map(docs.map((u) => [u._id.toHexString(), u.email ?? ""]))
}

function uniqueIds(ids: ObjectId[]): ObjectId[] {
  const seen = new Map<string, ObjectId>()
  for (const id of ids) seen.set(id.toHexString(), id)
  return [...seen.values()]
}

/** Never includes hfRequestId (projected out, and not in the row type). */
const GENERATION_FIELDS = {
  userId: 1,
  modelId: 1,
  modelLabel: 1,
  surface: 1,
  status: 1,
  cost: 1,
  error: 1,
  prompt: 1,
  outputs: 1,
  isPublic: 1,
  createdAt: 1,
} as const

export async function listGenerations(input: {
  status?: GenerationStatus
  modelId?: string
  page: number
}): Promise<{ rows: AdminGenerationRow[]; hasNext: boolean }> {
  const filter = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.modelId ? { modelId: input.modelId } : {}),
  }
  const docs = await generations()
    .find(filter, { projection: GENERATION_FIELDS })
    .sort({ createdAt: -1 })
    .skip((input.page - 1) * GENERATIONS_PAGE_SIZE)
    .limit(GENERATIONS_PAGE_SIZE + 1)
    .toArray()
  const page = docs.slice(0, GENERATIONS_PAGE_SIZE)
  const emails = await emailsFor(uniqueIds(page.map((d) => d.userId)))
  return {
    hasNext: docs.length > GENERATIONS_PAGE_SIZE,
    rows: page.map((d) => ({
      id: d._id.toHexString(),
      userId: d.userId.toHexString(),
      email: emails.get(d.userId.toHexString()) ?? null,
      modelId: d.modelId,
      modelLabel: d.modelLabel,
      surface: d.surface,
      status: d.status,
      cost: d.cost ?? 0,
      ...(d.error ? { error: d.error } : {}),
      prompt: d.prompt ?? "",
      outputs: (d.outputs ?? []).map((o) => ({ kind: o.kind, url: o.url })),
      isPublic: Boolean(d.isPublic),
      createdAt: d.createdAt.toISOString(),
    })),
  }
}

// --------------------------------------------------------------- models

export type AdminModelRow = {
  id: string
  label: string
  surface: Surface
  settings: ModelEntry["settings"]
  /** Effective rule (table + override). */
  rule: PriceRule | null
  tableRule: PriceRule | null
  enabled: boolean
  /** Quote for default settings; null when unpriced. */
  quote: Quote | null
  /** True when model_pricing overrides the rule (including "unpriced"). */
  hasRuleOverride: boolean
  hfUsdSource?: string
}

export async function listModelRows(): Promise<AdminModelRow[]> {
  const [pricing, overrides] = await Promise.all([
    effectivePricing(),
    modelPricing()
      .find({})
      .toArray()
      .catch((): ModelPricingDoc[] => []),
  ])
  const byId = new Map(overrides.map((o) => [o.modelId, o]))
  const config = priceConfig()
  return MODELS.map((model) => {
    const entry = pricing[model.id]
    const override = byId.get(model.id)
    const rule = entry?.rule ?? null
    let quote: Quote | null = null
    try {
      quote = priceFor(rule, parseSettings(model, {}), config)
    } catch {
      quote = null
    }
    return {
      id: model.id,
      label: model.label,
      surface: model.surface,
      settings: model.settings,
      rule,
      tableRule: PRICING_TABLE[model.id] ?? null,
      enabled: entry?.enabled ?? true,
      quote,
      hasRuleOverride: override?.rule !== undefined,
      ...(override?.hfUsdSource ? { hfUsdSource: override.hfUsdSource } : {}),
    }
  })
}

export function catalogModel(modelId: string): ModelEntry {
  const model = MODELS.find((m) => m.id === modelId)
  if (!model) throw new GenerationInputError("Unknown model.")
  return model
}

/** The setting names a rule refers to must exist on the model, and enum
    multiplier keys must be values that setting can take. */
export function assertRuleFitsModel(model: ModelEntry, rule: PriceRule): void {
  const fieldOf = (name: string) => {
    const field = model.settings[name]
    if (!field)
      throw new GenerationInputError(`${model.label} has no setting "${name}".`)
    return field
  }
  const { base } = rule
  if (base.kind === "per_image" && base.countSetting) fieldOf(base.countSetting)
  if (base.kind === "per_second") {
    const name = base.durationSetting ?? "duration"
    if (base.durationSetting || model.settings[name]) fieldOf(name)
  }
  for (const [name, table] of Object.entries(rule.multipliers ?? {})) {
    const field = fieldOf(name)
    if (field.type === "enum")
      for (const value of Object.keys(table))
        if (!field.values.includes(value))
          throw new GenerationInputError(
            `"${value}" isn't a value of ${name} on ${model.label}.`
          )
  }
}

/** `rule: null` marks the model explicitly unpriced. */
export async function setModelPricing(
  modelId: string,
  rule: PriceRule | null,
  source?: string
): Promise<void> {
  await modelPricing().updateOne(
    { modelId },
    {
      $set: { rule, ...(source ? { hfUsdSource: source } : {}) },
      ...(source ? {} : { $unset: { hfUsdSource: "" } }),
    },
    { upsert: true }
  )
  resetPricingCache()
}

/** Back to the static pricing table. Drops the doc unless it disables the model. */
export async function clearModelPricing(modelId: string): Promise<void> {
  await modelPricing().updateOne(
    { modelId },
    { $unset: { rule: "", hfUsdSource: "" } }
  )
  await modelPricing().deleteOne({ modelId, enabled: { $ne: false } })
  resetPricingCache()
}

export async function setModelEnabled(
  modelId: string,
  enabled: boolean
): Promise<void> {
  await modelPricing().updateOne(
    { modelId },
    { $set: { enabled } },
    { upsert: true }
  )
  resetPricingCache()
}

// -------------------------------------------------------------- presets

export type AdminPresetRow = {
  id: string
  slug: string
  title: string
  description?: string
  surface: Surface
  modelId: string
  promptTemplate: string
  settings: Record<string, unknown>
  coverUrl?: string
  category: string
  order: number
  active: boolean
  updatedAt: string
}

export type PresetInput = {
  slug: string
  title: string
  description?: string
  surface: Surface
  modelId: string
  promptTemplate: string
  settings: Record<string, unknown>
  coverUrl?: string
  category: string
  order: number
  active: boolean
}

export async function listAllPresets(): Promise<AdminPresetRow[]> {
  const docs = await presets()
    .find({})
    .sort({ category: 1, order: 1, title: 1 })
    .limit(500)
    .toArray()
  return docs.map((p) => ({
    id: p._id.toHexString(),
    slug: p.slug,
    title: p.title,
    ...(p.description ? { description: p.description } : {}),
    surface: p.surface,
    modelId: p.modelId,
    promptTemplate: p.promptTemplate,
    settings: p.settings ?? {},
    ...(p.coverUrl ? { coverUrl: p.coverUrl } : {}),
    category: p.category,
    order: p.order ?? 0,
    active: Boolean(p.active),
    updatedAt: (p.updatedAt ?? p.createdAt).toISOString(),
  }))
}

/** Model must exist and match the surface; settings must be valid for it.
    Returns only the settings the admin set, validated. */
function checkPresetModel(input: PresetInput): Record<string, unknown> {
  const model = catalogModel(input.modelId)
  if (model.surface !== input.surface)
    throw new GenerationInputError(
      `${model.label} is a ${model.surface} model, not ${input.surface}.`
    )
  for (const key of Object.keys(input.settings))
    if (!model.settings[key])
      throw new GenerationInputError(`${model.label} has no setting "${key}".`)
  let parsed: Record<string, unknown>
  try {
    parsed = parseSettings(model, input.settings)
  } catch (error) {
    throw new GenerationInputError(
      error instanceof Error ? error.message : "Invalid settings."
    )
  }
  return Object.fromEntries(
    Object.keys(input.settings).map((key) => [key, parsed[key]])
  )
}

async function assertSlugFree(slug: string, except?: ObjectId) {
  const taken = await presets().findOne(
    except ? { slug, _id: { $ne: except } } : { slug }
  )
  if (taken) throw new GenerationInputError("That slug is already used.")
}

export async function createPreset(input: PresetInput): Promise<string> {
  const settings = checkPresetModel(input)
  await assertSlugFree(input.slug)
  const now = new Date()
  const doc: PresetDoc = {
    _id: new ObjectId(),
    slug: input.slug,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    surface: input.surface,
    modelId: input.modelId,
    promptTemplate: input.promptTemplate,
    settings,
    ...(input.coverUrl ? { coverUrl: input.coverUrl } : {}),
    category: input.category,
    order: input.order,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  }
  try {
    await presets().insertOne(doc)
  } catch (error) {
    if (isDuplicate(error))
      throw new GenerationInputError("That slug is already used.")
    throw error
  }
  return doc._id.toHexString()
}

export async function updatePreset(
  id: string,
  input: PresetInput
): Promise<void> {
  const _id = oid(id, "Effect")
  const settings = checkPresetModel(input)
  await assertSlugFree(input.slug, _id)
  const unset = {
    ...(input.description ? {} : { description: "" as const }),
    ...(input.coverUrl ? {} : { coverUrl: "" as const }),
  }
  try {
    const result = await presets().updateOne(
      { _id },
      {
        $set: {
          slug: input.slug,
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          surface: input.surface,
          modelId: input.modelId,
          promptTemplate: input.promptTemplate,
          settings,
          ...(input.coverUrl ? { coverUrl: input.coverUrl } : {}),
          category: input.category,
          order: input.order,
          active: input.active,
          updatedAt: new Date(),
        },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      }
    )
    if (!result.matchedCount)
      throw new GenerationInputError("Effect not found.")
  } catch (error) {
    if (isDuplicate(error))
      throw new GenerationInputError("That slug is already used.")
    throw error
  }
}

export async function setPresetActive(
  id: string,
  active: boolean
): Promise<void> {
  const result = await presets().updateOne(
    { _id: oid(id, "Effect") },
    { $set: { active, updatedAt: new Date() } }
  )
  if (!result.matchedCount) throw new GenerationInputError("Effect not found.")
}

export async function deletePreset(id: string): Promise<void> {
  const result = await presets().deleteOne({ _id: oid(id, "Effect") })
  if (!result.deletedCount) throw new GenerationInputError("Effect not found.")
}

// ----------------------------------------------------------- moderation

export type AdminReportGroup = {
  generationId: string
  count: number
  reasons: Partial<Record<ReportDoc["reason"], number>>
  notes: string[]
  latestAt: string
  generation: {
    prompt: string
    modelLabel: string
    surface: Surface
    status: GenerationStatus
    isPublic: boolean
    ownerEmail: string | null
    outputs: Pick<GenerationOutput, "kind" | "url">[]
  } | null
}

export async function listOpenReportGroups(): Promise<AdminReportGroup[]> {
  const open = await reports()
    .find({ status: "open" })
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray()
  const groups = new Map<string, { id: ObjectId; items: ReportDoc[] }>()
  for (const r of open) {
    const key = r.generationId.toHexString()
    const group = groups.get(key) ?? { id: r.generationId, items: [] }
    group.items.push(r)
    groups.set(key, group)
  }
  const ids = [...groups.values()].map((g) => g.id)
  const gens = ids.length
    ? await generations()
        .find({ _id: { $in: ids } }, { projection: GENERATION_FIELDS })
        .toArray()
    : []
  const genById = new Map(gens.map((g) => [g._id.toHexString(), g]))
  const emails = await emailsFor(uniqueIds(gens.map((g) => g.userId)))
  return [...groups.entries()]
    .map(([key, { items }]): AdminReportGroup => {
      const reasons: AdminReportGroup["reasons"] = {}
      for (const r of items) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1
      const g = genById.get(key)
      return {
        generationId: key,
        count: items.length,
        reasons,
        notes: items
          .map((r) => r.note?.trim())
          .filter((n): n is string => Boolean(n))
          .slice(0, 5),
        latestAt: items[0]!.createdAt.toISOString(),
        generation: g
          ? {
              prompt: g.prompt ?? "",
              modelLabel: g.modelLabel,
              surface: g.surface,
              status: g.status,
              isPublic: Boolean(g.isPublic),
              ownerEmail: emails.get(g.userId.toHexString()) ?? null,
              outputs: (g.outputs ?? []).map((o) => ({
                kind: o.kind,
                url: o.url,
              })),
            }
          : null,
      }
    })
    .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt))
}

export async function dismissReports(
  generationId: string,
  adminId: string
): Promise<number> {
  const result = await reports().updateMany(
    { generationId: oid(generationId, "Report"), status: "open" },
    {
      $set: {
        status: "dismissed",
        resolvedBy: new ObjectId(adminId),
        resolvedAt: new Date(),
      },
    }
  )
  return result.modifiedCount
}

/** Take a generation off the community feed and close its open reports. */
export async function unpublishGeneration(
  generationId: string,
  adminId: string
): Promise<{ actioned: number }> {
  const _id = oid(generationId, "Generation")
  const now = new Date()
  const updated = await generations().updateOne(
    { _id },
    { $set: { isPublic: false, updatedAt: now }, $unset: { publishedAt: "" } }
  )
  const open = await reports().countDocuments({
    generationId: _id,
    status: "open",
  })
  if (!updated.matchedCount && !open)
    throw new GenerationInputError("Generation not found.")
  const result = await reports().updateMany(
    { generationId: _id, status: "open" },
    {
      $set: {
        status: "actioned",
        resolvedBy: new ObjectId(adminId),
        resolvedAt: now,
      },
    }
  )
  return { actioned: result.modifiedCount }
}
