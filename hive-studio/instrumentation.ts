/** Runs once per server start. Fails a production boot on a missing or
    malformed variable (only the groups this deployment's mode needs); in
    development it lists what is still unset.

    The reconciler runs in-process when INTERNAL_CRON_SECONDS > 0 (Docker
    hosts have no Vercel Cron, D-059), or every 5s in development when there's
    no public webhook URL so local generations still finish. DB_INIT_AT_BOOT=1
    applies the indexes on start (the standalone image has no tsx for db:init). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { checkEnvAtBoot, env } = await import("./lib/env")
  const gaps = checkEnvAtBoot()
  if (gaps.length)
    console.warn(`[env] not configured yet:\n  - ${gaps.join("\n  - ")}`)

  const e = env()
  console.info(`[studio] mode=${e.STUDIO_MODE} storage=${e.STORAGE_DRIVER}`)

  if (process.env.DB_INIT_AT_BOOT === "1" && e.MONGODB_URI) {
    const [{ db }, { ensureIndexes }] = await Promise.all([
      import("./lib/db/mongo"),
      import("./lib/db/indexes"),
    ])
    try {
      const count = await ensureIndexes(db())
      console.info(`[db-init] ${count} indexes ensured`)
    } catch (error) {
      console.error("[db-init] failed", String(error))
    }
  }

  const devPoller =
    process.env.NODE_ENV === "development" &&
    e.MONGODB_URI &&
    e.HF_CREDENTIALS &&
    !e.HF_WEBHOOK_BASE_URL
  const seconds =
    e.INTERNAL_CRON_SECONDS > 0 ? e.INTERNAL_CRON_SECONDS : devPoller ? 5 : 0
  if (!seconds || !e.MONGODB_URI) return

  const { reconcile } = await import("./lib/generations/lifecycle")
  let busy = false
  setInterval(() => {
    if (busy) return
    busy = true
    reconcile()
      .catch((error: unknown) => console.error("[reconcile]", String(error)))
      .finally(() => {
        busy = false
      })
  }, seconds * 1000).unref()
  console.info(`[reconcile] in-process every ${seconds}s`)
}
