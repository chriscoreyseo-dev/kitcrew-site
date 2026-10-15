/** Runs once per server start. Fails a production boot on a missing or
    malformed variable; in development it lists what is still unset and, when
    there's no public webhook URL, runs the reconciler on a timer in place of
    Vercel Cron so local generations still finish. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { checkEnvAtBoot, env } = await import("./lib/env")
  const gaps = checkEnvAtBoot()
  if (gaps.length)
    console.warn(`[env] not configured yet:\n  - ${gaps.join("\n  - ")}`)

  const e = env()
  if (
    process.env.NODE_ENV === "development" &&
    e.MONGODB_URI &&
    e.HF_CREDENTIALS &&
    !e.HF_WEBHOOK_BASE_URL
  ) {
    const { reconcile } = await import("./lib/generations/lifecycle")
    let busy = false
    setInterval(() => {
      if (busy) return
      busy = true
      reconcile()
        .catch((error: unknown) =>
          console.error("[dev-reconcile]", String(error))
        )
        .finally(() => {
          busy = false
        })
    }, 5_000).unref()
    console.info("[dev-reconcile] polling every 5s (no HF_WEBHOOK_BASE_URL)")
  }
}
