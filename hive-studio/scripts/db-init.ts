/** Create every collection index. Idempotent; run after each deploy that
    changes lib/db/indexes.ts:  pnpm db:init  (reads MONGODB_URI, MONGODB_DB). */
import { MongoClient } from "mongodb"

import { ensureIndexes } from "../lib/db/indexes"

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("Set MONGODB_URI (see .env.example).")
  const client = new MongoClient(uri, { appName: "hive-studio-db-init" })
  try {
    await client.connect()
    const count = await ensureIndexes(
      client.db(process.env.MONGODB_DB || "hive-studio"),
      console.log
    )
    console.log(`db-init: ${count} indexes ensured`)
  } finally {
    await client.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
