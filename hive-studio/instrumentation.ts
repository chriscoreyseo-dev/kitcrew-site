/** Runs once per server start. Fails a production boot on a missing or
    malformed variable; in development it lists what is still unset. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { checkEnvAtBoot } = await import("./lib/env")
  const gaps = checkEnvAtBoot()
  if (gaps.length)
    console.warn(`[env] not configured yet:\n  - ${gaps.join("\n  - ")}`)
}
