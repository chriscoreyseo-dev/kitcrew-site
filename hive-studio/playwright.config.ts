import { defineConfig, devices } from "@playwright/test"

/** End-to-end suite for both deployments (D-062). Every external service is
    mocked by e2e/mocks/server.mjs; the studios run the real production build.
      pnpm build && pnpm e2e */

const MOCK = 4010
const MH = 3101
const SA = 3102

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "markethive",
      testMatch: /markethive\.spec\.ts/,
      use: { baseURL: `http://localhost:${MH}` },
    },
    {
      name: "standalone",
      testMatch: /standalone\.spec\.ts/,
      use: { baseURL: `http://localhost:${SA}` },
    },
  ],
  webServer: [
    {
      command: "node e2e/mocks/server.mjs",
      url: `http://127.0.0.1:${MOCK}/_state`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `node e2e/start-studio.mjs markethive ${MH}`,
      url: `http://localhost:${MH}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `node e2e/start-studio.mjs standalone ${SA}`,
      url: `http://localhost:${SA}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
})
