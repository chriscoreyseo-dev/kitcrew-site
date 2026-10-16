/** Generate cover media for effects through the app's own lifecycle
    (submit → poll → copy to R2), then set `presets.coverUrl`.

      pnpm showcase --email you@example.com            # effects without a cover
      pnpm showcase --email you@example.com --force    # regenerate every cover
      pnpm showcase --email you@example.com --only slow-dolly-reveal,levitate

    Needs MONGODB_URI, HF_CREDENTIALS and the R2 vars (covers must outlive the
    platform's ~7 day URLs). The runs belong to the account behind --email,
    which must have signed in once; they appear in its library and are charged
    to it like any other run. Run `pnpm presets:seed` first. */
import { randomUUID } from "node:crypto"
import { parseArgs } from "node:util"

import type { ObjectId } from "mongodb"

import { MODELS } from "@/generation/catalog/models.generated"
import { db, mongoClient } from "@/lib/db/mongo"
import { requireEnv } from "@/lib/env"
import {
  finalizeGeneration,
  generations,
  submitGeneration,
} from "@/lib/generations/lifecycle"
import { presets } from "@/lib/presets"
import type { PresetDoc } from "@/lib/presets"
import { isStorageConfigured } from "@/lib/storage"

/** What fills `{subject}` in each starter effect's cover. */
const SUBJECTS: Record<string, string> = {
  "slow-dolly-reveal": "a lone violinist on an empty theater stage",
  "golden-hour-orbit": "a vintage motorcycle parked on a desert road",
  "neon-rain-chase": "a courier in a yellow raincoat",
  levitate: "a ceramic teapot",
  "paper-unfold": "a paper city skyline",
  "product-turntable": "a matte black wireless headphone",
  "editorial-portrait": "a silver-haired jazz pianist",
  "film-still-35mm": "two friends sharing fries in a late-night diner",
  "floating-product": "a glass perfume bottle",
  "miniature-world": "a busy harbor with tiny cargo ships",
  "risograph-poster": "a hummingbird among tropical flowers",
  "clay-character": "a grumpy cat chef",
}
const DEFAULT_SUBJECT = "a honeybee resting on a lavender stem"

const POLL_MS = 10_000
const DEADLINE_MS = 15 * 60_000 // matches the lifecycle's RUN_DEADLINE_MS

function fill(template: string, slug: string) {
  return template.replaceAll("{subject}", SUBJECTS[slug] ?? DEFAULT_SUBJECT)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor(id: ObjectId): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < DEADLINE_MS) {
    await finalizeGeneration(id).catch((error: unknown) =>
      console.warn("  poll failed, retrying:", (error as Error).message)
    )
    const doc = await generations().findOne({ _id: id })
    if (!doc) throw new Error("generation disappeared")
    if (doc.status === "completed") {
      const url = doc.outputs[0]?.url
      if (!url) throw new Error("completed without outputs")
      return url
    }
    if (["failed", "nsfw", "canceled"].includes(doc.status))
      throw new Error(doc.error ?? doc.status)
    await sleep(POLL_MS)
  }
  throw new Error("timed out after 15 minutes")
}

async function cover(preset: PresetDoc, userId: string): Promise<string> {
  const run = await submitGeneration({
    userId,
    clientRequestId: `showcase:${preset.slug}:${randomUUID()}`,
    plane: {
      model: preset.modelId,
      prompt: { text: fill(preset.promptTemplate, preset.slug) },
      media: {},
      settings: preset.settings,
    },
  })
  if (run.status === "failed") throw new Error(run.error ?? "submit failed")
  return waitFor(run._id)
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      force: { type: "boolean", default: false },
      only: { type: "string" },
    },
  })
  if (!values.email) throw new Error("Pass --email of an existing account.")
  requireEnv("db")
  requireEnv("higgsfield")
  if (!isStorageConfigured())
    throw new Error("Set the R2 vars first: covers must be stored durably.")

  const user = await db()
    .collection<{ _id: ObjectId; email: string }>("users")
    .findOne({ email: values.email.toLowerCase() })
  if (!user)
    throw new Error(`No account for ${values.email}. Sign in once first.`)

  const installed = new Set(MODELS.map((m) => m.id))
  const only = values.only?.split(",").map((s) => s.trim())
  const targets = (await presets().find({ active: true }).toArray()).filter(
    (p) =>
      installed.has(p.modelId) &&
      (only ? only.includes(p.slug) : values.force || !p.coverUrl)
  )
  if (!targets.length) {
    console.log("showcase: nothing to do")
    return
  }

  let failed = 0
  // Sequential on purpose: plan parallel limits apply to this account too.
  for (const preset of targets) {
    console.log(`showcase: ${preset.slug} (${preset.modelId})`)
    try {
      const url = await cover(preset, user._id.toHexString())
      await presets().updateOne(
        { _id: preset._id },
        { $set: { coverUrl: url, updatedAt: new Date() } }
      )
      console.log(`  cover set: ${url}`)
    } catch (error) {
      failed++
      console.error(`  failed: ${(error as Error).message}`)
    }
  }
  console.log(
    `showcase: ${targets.length - failed} covers set, ${failed} failed`
  )
  if (failed) process.exitCode = 1
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (process.env.MONGODB_URI) await mongoClient().close()
  })
