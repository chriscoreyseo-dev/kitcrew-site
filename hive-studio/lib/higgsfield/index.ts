import "server-only"

import { requireEnv } from "@/lib/env"

import { createPlatformClient } from "./platform"

export { PlatformError } from "./platform"
export type { GenerationStatus, QueuedGeneration, StatusResult } from "./types"

/** The one platform client, configured from server env. */
export function platform() {
  const { HF_CREDENTIALS, HF_API_BASE_URL } = requireEnv("higgsfield")
  return createPlatformClient({
    apiKey: HF_CREDENTIALS,
    baseUrl: HF_API_BASE_URL,
  })
}
