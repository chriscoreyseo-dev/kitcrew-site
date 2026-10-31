import "server-only"

import type { StudioModeInfo } from "@/components/site/studio-mode"
import { env } from "@/lib/env"

/** MarketHive's wallet, opened on the Hive Vault section (the wallet's own
    ?wallet-popup-subsection-vault deep link in script_nav_main.php). */
export function hiveVaultUrl(home: string): string {
  return `${home.replace(/\/$/, "")}/index_members?wallet-popup-subsection-vault`
}

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
    // Add credits opens the member's Hive Vault, where they fund it. Before
    // S581 the default was the home page, so the button only reloaded it.
    creditsUrl: e.MARKETHIVE_CREDITS_URL ?? (home ? hiveVaultUrl(home) : null),
    homeUrl: home,
  }
}
