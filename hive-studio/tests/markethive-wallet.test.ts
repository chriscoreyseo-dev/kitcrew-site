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
        amountCents: 125,
      })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(wallet.WalletDeclinedError)
    expect(
      (error as InstanceType<typeof wallet.WalletDeclinedError>).balance
    ).toBe(20)
  })

  it("sends the run's cost-based amount in dollars (S577-DRL-02)", async () => {
    reply = () => json({ ok: true, charged: "1.25", balance: "8.75" })
    const out = await wallet.walletDebit({
      memberId: 7,
      ref: "c".repeat(24),
      surface: "video",
      model: "m",
      amountCents: 125,
    })
    const body = JSON.parse(seen[seen.length - 1]!.body)
    expect(body).toMatchObject({
      action: "debit",
      member_id: 7,
      amount: "1.25",
    })
    expect(out).toEqual({ charged: 125, balance: 875 })
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

  it("posts a shared item to the News Feed, signed (S584)", async () => {
    reply = () =>
      json({
        ok: true,
        post_slug: "abc",
        post_url: "https://dev3.markethive.test/newsfeed/abc",
        existing: false,
      })
    const r = await wallet.postToNewsfeed({
      memberId: 7,
      slug: "a".repeat(24),
      caption: "x".repeat(600),
    })
    expect(r).toEqual({
      postUrl: "https://dev3.markethive.test/newsfeed/abc",
      existing: false,
    })
    const call = seen[0]!
    const body = JSON.parse(call.body) as Record<string, unknown>
    expect(body).toMatchObject({
      action: "feed_post",
      member_id: 7,
      slug: "a".repeat(24),
    })
    expect((body.caption as string).length).toBe(500)
    expect(verifyWallet(SECRET, call.ts, call.body, call.sig)).toBe(true)
  })

  it("a News Feed refusal is a decline with MarketHive's words", async () => {
    reply = () =>
      json({
        ok: false,
        error: "not_owner",
        message: "Only the member who made it can post it.",
      })
    await expect(
      wallet.postToNewsfeed({ memberId: 8, slug: "a".repeat(24) })
    ).rejects.toMatchObject({
      name: "WalletDeclinedError",
      code: "not_owner",
      message: "Only the member who made it can post it.",
    })
  })

  it("never follows a non-https post URL", async () => {
    reply = () => json({ ok: true, post_url: "javascript:alert(1)" })
    await expect(
      wallet.postToNewsfeed({ memberId: 7, slug: "a".repeat(24) })
    ).rejects.toBeInstanceOf(wallet.WalletUnavailableError)
  })

  it("toCents rounds float noise and rejects junk", () => {
    expect(wallet.toCents("0.1")).toBe(10)
    expect(wallet.toCents(0.29)).toBe(29)
    expect(wallet.toCents("abc")).toBeNull()
    expect(wallet.toCents(null)).toBeNull()
  })
})
