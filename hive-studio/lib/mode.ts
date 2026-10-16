import "server-only"

import { env } from "@/lib/env"

/** Which deployment this server is (D-055). Read at runtime, so one image
    serves either deployment; the browser learns it from the root layout. */
export type StudioMode = "standalone" | "markethive"

export function studioMode(): StudioMode {
  return env().STUDIO_MODE
}

export function isMarketHive(): boolean {
  return studioMode() === "markethive"
}
