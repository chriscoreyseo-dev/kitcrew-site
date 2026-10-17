import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

/** markethive mode, end to end: the dashboard frames the studio, the handoff
    signs the member in, and every generation is paid and refunded through
    MarketHive's wallet (all mocked by e2e/mocks/server.mjs). */

const MOCK = "http://127.0.0.1:4010"

type MockState = {
  members: Record<string, string>
  charges: Record<string, { mid: number; amount: number; status: string }>
}

async function mockState(page: Page): Promise<MockState> {
  return (await (await page.request.get(`${MOCK}/_state`)).json()) as MockState
}

async function signIn(page: Page, mid: number) {
  await page.goto(`${MOCK}/launch?mid=${mid}&next=/image`)
  await expect(page).toHaveURL(/\/image$/)
}

async function generate(page: Page, prompt: string) {
  await page.locator("textarea").fill(prompt)
  await page.getByRole("button", { name: /^Generate ✦ 0\.50$/i }).click()
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/_reset`)
})

test("the dashboard overlay frames the studio and the handoff signs the member in", async ({
  page,
}) => {
  await page.goto(`${MOCK}/dashboard?mid=101`)
  const studio = page.frameLocator("#studio")
  // Signed in inside a third-party frame: the Partitioned session cookie works.
  await expect(studio.getByRole("link", { name: /Add credits/ })).toBeVisible()
  await expect(
    studio.getByRole("link", { name: /10\.00 Hive credits/ })
  ).toBeVisible()
  await expect(
    studio.getByRole("button", { name: /Generate ✦ 0\.50/i })
  ).toBeVisible()
})

test("only MarketHive may frame the studio", async ({ request }) => {
  const response = await request.get("/image")
  const csp = response.headers()["content-security-policy"] ?? ""
  expect(csp).toContain(`frame-ancestors ${MOCK}`)
  expect(response.headers()["x-frame-options"]).toBeUndefined()
})

test("a generation debits Hive credits once and stores the output", async ({
  page,
}) => {
  await signIn(page, 101)
  await generate(page, "a honeycomb glowing at dawn")
  await expect(page.locator('img[src*="/media/u/"]').first()).toBeVisible({
    timeout: 45_000,
  })
  const state = await mockState(page)
  expect(state.members["101"]).toBe("9.50")
  const charges = Object.values(state.charges)
  expect(charges).toHaveLength(1)
  expect(charges[0]).toMatchObject({ mid: 101, amount: 50, status: "debited" })
  // The header follows MarketHive's balance.
  await page.reload()
  await expect(
    page.getByRole("link", { name: /9\.50 Hive credits/ })
  ).toBeVisible()
})

test("a failed generation is refunded through MarketHive exactly once", async ({
  page,
}) => {
  await signIn(page, 101)
  await generate(page, "FAILME please")
  await expect(page.getByText("Generation unavailable").first()).toBeVisible({
    timeout: 45_000,
  })
  await expect
    .poll(async () => (await mockState(page)).members["101"], {
      timeout: 15_000,
    })
    .toBe("10.00")
  const charges = Object.values((await mockState(page)).charges)
  expect(charges).toEqual([{ mid: 101, amount: 50, status: "refunded" }])
})

test("not enough Hive credits: nothing runs and Add credits points at MarketHive", async ({
  page,
}) => {
  await signIn(page, 103)
  await generate(page, "a bee in amber")
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Add Hive credits")).toBeVisible()
  await expect(dialog.getByText(/Your balance is 0\.20/)).toBeVisible()
  await expect(
    dialog.getByRole("link", { name: "Add credits on MarketHive" })
  ).toHaveAttribute("href", `${MOCK}/wallet`)
  expect(Object.keys((await mockState(page)).charges)).toHaveLength(0)
})

test("generation stays admins-only until prices are ruled", async ({
  page,
}) => {
  await signIn(page, 102)
  await generate(page, "a quiet meadow")
  await expect(page.getByText("isn't open to your account yet")).toBeVisible()
  expect(Object.keys((await mockState(page)).charges)).toHaveLength(0)
})

test("handoff tokens are single-use and forgeries are refused", async ({
  page,
  request,
}) => {
  const launch = await request.get(`${MOCK}/launch?mid=101`, {
    maxRedirects: 0,
  })
  const target = launch.headers()["location"]!
  await page.goto(target)
  await expect(page).toHaveURL(/\/image$/)
  await page.context().clearCookies()
  await page.goto(target)
  await expect(page.getByText(/already used/)).toBeVisible()
  await page.goto("/auth/markethive?token=forged.token")
  await expect(page.getByText("Couldn't sign you in")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Go to MarketHive" })
  ).toBeVisible()
})

test("no magic links and no Stripe in this mode", async ({ page, request }) => {
  expect((await request.get("/api/auth/providers")).status()).toBe(404)
  expect(
    (await request.post("/api/webhooks/stripe", { data: "{}" })).status()
  ).toBe(404)
  await page.goto("/pricing")
  await expect(
    page.getByText("Hive Studio is paid with your MarketHive credits", {
      exact: false,
    })
  ).toBeVisible()
  await expect(page.getByText("✦ 0.50")).toBeVisible()
  await page.goto("/login")
  await expect(
    page.getByText("opens from your MarketHive dashboard")
  ).toBeVisible()
})
