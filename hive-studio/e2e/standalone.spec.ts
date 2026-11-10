import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { MongoClient } from "mongodb"

/** standalone mode (studio.kitcrew.ai), end to end: magic-link sign-in,
    the studio's own credit ledger, and no framing. Resend, Higgsfield and
    MongoDB are mocked by e2e/mocks/server.mjs; Stripe is never called. */

const MOCK = "http://127.0.0.1:4010"
const MONGO =
  "mongodb://127.0.0.1:27117/?replicaSet=rs0e2e&directConnection=true"
const EMAIL = "buyer@studio-e2e.com"

let mongo: MongoClient

test.beforeAll(async () => {
  mongo = await MongoClient.connect(MONGO)
  // Price the test model: 0.10 USD x 1.5 markup / 0.01 = 15 credits a run.
  await mongo
    .db("e2e-standalone")
    .collection("model_pricing")
    .updateOne(
      { modelId: "z-image-turbo" },
      {
        $set: { rule: { base: { kind: "per_run", usd: 0.1 } }, enabled: true },
      },
      { upsert: true }
    )
})

test.afterAll(async () => {
  await mongo?.close()
})

async function signInByEmail(page: Page) {
  await page.goto("/login?next=%2Fimage%3Fmodel%3Dz-image-turbo")
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByRole("button", { name: /Email me a sign-in link/i }).click()
  await expect(page.getByText("Check your email")).toBeVisible()
  const emails = (await (
    await page.request.get(`${MOCK}/_emails?to=${EMAIL}`)
  ).json()) as { link?: string }[]
  const link = emails.at(-1)?.link
  expect(link).toBeTruthy()
  await page.goto(link!)
  await expect(page).toHaveURL(/\/image/)
}

test("cannot be framed by anyone", async ({ request }) => {
  const response = await request.get("/")
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  )
  expect(response.headers()["x-frame-options"]).toBe("DENY")
})

test("magic link signs in, then a generation spends and a failure refunds", async ({
  page,
}) => {
  await signInByEmail(page)
  // Sign-up bonus from the ledger.
  await expect(page.getByRole("link", { name: /^100 credits/ })).toBeVisible()

  await page.locator("textarea").fill("a lighthouse at dusk")
  await page.getByRole("button", { name: /^Generate ✦ 15$/i }).click()
  await expect(page.locator('img[src*="/media/u/"]').first()).toBeVisible({
    timeout: 45_000,
  })

  await page.locator("textarea").fill("FAILME on purpose")
  await page.getByRole("button", { name: /^Generate ✦ 15$/i }).click()
  await expect(page.getByText("Generation unavailable").first()).toBeVisible({
    timeout: 45_000,
  })

  const db = mongo.db("e2e-standalone")
  const user = await db.collection("users").findOne({ email: EMAIL })
  await expect
    .poll(
      async () =>
        (await db.collection("users").findOne({ email: EMAIL }))?.credits
    )
    .toEqual({ subscription: 0, topup: 85 })
  const ledger = await db
    .collection("credit_ledger")
    .find({ userId: user!._id })
    .toArray()
  expect(ledger.map((e) => e.reason).sort()).toEqual([
    "generation_debit",
    "generation_debit",
    "generation_refund",
    "signup_bonus",
  ])
})

test("pricing shows plans; MarketHive handoff doesn't exist here", async ({
  page,
  request,
}) => {
  await page.goto("/pricing")
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible()
  await expect(page.getByText("Compare plans")).toBeVisible()
  expect((await request.get("/auth/markethive?token=x")).status()).toBe(404)
  expect((await request.get("/api/health")).ok()).toBe(true)
})
