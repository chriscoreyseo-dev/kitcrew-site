import "server-only"

import type { StudioModeInfo } from "@/components/site/studio-mode"
import { env } from "@/lib/env"

/** The browser-safe description of this deployment. No secrets. */
export function studioModeInfo(): StudioModeInfo {
  const e = env()
  if (e.STUDIO_MODE !== "markethive")
    return {
      mode: "standalone",
      unit: "credits",
      creditsUrl: null,
      homeUrl: null,
    }
  const home = e.MARKETHIVE_BASE_URL ?? null
  return {
    mode: "markethive",
    unit: "hive",
    creditsUrl: e.MARKETHIVE_CREDITS_URL ?? home,
    homeUrl: home,
  }
}
