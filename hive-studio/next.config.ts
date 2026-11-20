import type { NextConfig } from "next"

import { syncModels, watchModels } from "./scripts/sync-models.mjs"

// Keep the model barrel + registry items in sync with generation/catalog/models/*.
syncModels()
if (process.env.NODE_ENV === "development") watchModels()

const nextConfig: NextConfig = {
  agentRules: false,
  // Self-contained server bundle for the Docker image (Coolify / any Docker
  // host, D-059). Vercel ignores it and builds as usual.
  output: "standalone",
  // The app sits in kitcrew-site/hive-studio; trace from here, not the repo root.
  outputFileTracingRoot: process.cwd(),
}

export default nextConfig
