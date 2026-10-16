import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const SECRET = "w".repeat(40)

vi.mock("@/lib/env", () => ({
  requireEnv: () => ({
    MARKETHIVE_BASE_URL: "https://dev3.markethive.test",
    MARKETHIVE_SHARED_SECRET: SECRET,
  }),
}))

const { verifyWallet } = await import("@/lib/markethive/signing")
const wallet = await import("@/lib/markethive/wallet")

type Seen = { url: string; body: string; ts: number; sig: string }
let seen: Seen[] = []
let reply: () => Response

beforeEach(() => {
  seen = []
  wallet.resetWalletPriceCache()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers)
      seen.push({
        url: String(url),
        body: String(init.body),
        ts: Number(headers.get("x-hive-studio-ts")),
        sig: headers.get("x-hive-studio-sig") ?? "",
      })
      return reply()
    })
  )
})
afterEach(() => vi.unstubAllGlobals())

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("MarketHive wallet client", () => {
  it("signs every call and converts dollars to cents", async () => {
    reply = () =>
      json({
        ok: true,
        balance: "12.34",
        prices: { image: "0.50", video: "2.00", audio: null },
      })
    const snap = await wallet.walletSnapshot(7)
    expect(snap).toEqual({
      balance: 1234,
      prices: { image: 50, video: 200, audio: null },
    })
    const call = seen[0]!
    expect(call.url).toBe("https://dev3.markethive.test/hive_studio_api.php")
    expect(JSON.parse(call.body)).toEqual({ action: "balance", member_id: 7 })
    expect(verifyWallet(SECRET, call.ts, call.body, call.sig)).toBe(true)
  })

  it("maps a decline to WalletDeclinedError with the balance", async () => {
    reply = () =>
      json({ ok: false, error: "insufficient", message: "No", balance: "0.20" })
    const error = await wallet
      .walletDebit({
        memberId: 7,
        ref: "a".repeat(24),
        surface: "image",
        model: "m",
      })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(wallet.WalletDeclinedError)
    expect(
      (error as InstanceType<typeof wallet.WalletDeclinedError>).balance
    ).toBe(20)
  })

  it("never reads an HTML 200 (dev3's catch-all) as success", async () => {
    reply = () => new Response("<html>MarketHive</html>", { status: 200 })
    await expect(
      wallet.walletRefund({ memberId: 7, ref: "b".repeat(24) })
    ).rejects.toBeInstanceOf(wallet.WalletUnavailableError)
  })

  it("a network failure is 'unavailable', not a decline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed")
      })
    )
    await expect(wallet.walletPrices()).rejects.toBeInstanceOf(
      wallet.WalletUnavailableError
    )
  })

  it("caches prices briefly", async () => {
    reply = () =>
      json({ ok: true, prices: { image: "1", video: "2", audio: "3" } })
    await wallet.walletPrices(1000)
    await wallet.walletPrices(2000)
    expect(seen).toHaveLength(1)
    await wallet.walletPrices(40_000)
    expect(seen).toHaveLength(2)
  })

  it("toCents rounds float noise and rejects junk", () => {
    expect(wallet.toCents("0.1")).toBe(10)
    expect(wallet.toCents(0.29)).toBe(29)
    expect(wallet.toCents("abc")).toBeNull()
    expect(wallet.toCents(null)).toBeNull()
  })
})
