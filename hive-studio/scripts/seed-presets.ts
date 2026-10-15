/** Upsert the starter effects by slug. Idempotent; safe to re-run:
      pnpm presets:seed   (reads MONGODB_URI, MONGODB_DB). */
import { MongoClient } from "mongodb"

import { MODELS } from "../generation/catalog/models.generated"
import { PRESET_SEED, upsertPresets } from "../lib/preset-seed"

async function main() {
  const installed = new Set(MODELS.map((m) => m.id))
  const missing = PRESET_SEED.filter((p) => !installed.has(p.modelId))
  if (missing.length)
    throw new Error(
      `Seed uses models that aren't installed: ${missing
        .map((p) => `${p.slug} -> ${p.modelId}`)
        .join(", ")}`
    )
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("Set MONGODB_URI (see .env.example).")
  const client = new MongoClient(uri, { appName: "hive-studio-seed-presets" })
  try {
    await client.connect()
    const count = await upsertPresets(
      client.db(process.env.MONGODB_DB || "hive-studio")
    )
    console.log(`presets:seed: ${count} presets upserted`)
  } finally {
    await client.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
