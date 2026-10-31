import { env } from "@/lib/env"

/** Liveness for Docker / Coolify healthchecks. Says which deployment this is
    (so a check can tell a real studio from a host's catch-all 200 page) and
    nothing else: no versions, no config. */
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    { ok: true, service: "hive-studio", mode: env().STUDIO_MODE },
    { headers: { "Cache-Control": "no-store" } }
  )
}
