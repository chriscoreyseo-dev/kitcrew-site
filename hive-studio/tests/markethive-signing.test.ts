import { describe, expect, it } from "vitest"

import {
  HandoffError,
  signHandoff,
  signWallet,
  verifyHandoff,
  verifyWallet,
} from "@/lib/markethive/signing"
import type { HandoffClaims } from "@/lib/markethive/signing"

const SECRET = "s".repeat(40)
const NOW = 1_800_000_000

const claims = (extra: Partial<HandoffClaims> = {}): HandoffClaims => ({
  v: 1,
  mid: 154950,
  email: "Member@Example.com",
  name: "Hive Member",
  admin: false,
  iat: NOW,
  exp: NOW + 90,
  nonce: "0123456789abcdef0123",
  ...extra,
})

describe("handoff tokens", () => {
  it("round-trips and normalises the email", () => {
    const out = verifyHandoff(signHandoff(claims(), SECRET), SECRET, NOW + 5)
    expect(out.mid).toBe(154950)
    expect(out.email).toBe("member@example.com")
    expect(out.admin).toBe(false)
  })

  it("rejects a tampered payload or a different secret", () => {
    const token = signHandoff(claims(), SECRET)
    const [, sig] = token.split(".")
    const forged = `${Buffer.from(JSON.stringify(claims({ admin: true }))).toString("base64url")}.${sig}`
    expect(() => verifyHandoff(forged, SECRET, NOW)).toThrow(HandoffError)
    expect(() => verifyHandoff(token, "x".repeat(40), NOW)).toThrow(
      HandoffError
    )
  })

  it("rejects expired tokens and ones older than two minutes", () => {
    const token = signHandoff(claims(), SECRET)
    expect(() => verifyHandoff(token, SECRET, NOW + 91)).toThrow(/expired/)
    const long = signHandoff(claims({ exp: NOW + 3600 }), SECRET)
    expect(() => verifyHandoff(long, SECRET, NOW + 121)).toThrow(/expired/)
  })

  it("rejects malformed tokens and missing claims", () => {
    expect(() => verifyHandoff("nope", SECRET, NOW)).toThrow(HandoffError)
    const bad = signHandoff(claims({ nonce: "short" }), SECRET)
    expect(() => verifyHandoff(bad, SECRET, NOW)).toThrow(/Malformed/)
  })

  it("a wallet signature can never pass as a handoff token (domain separation)", () => {
    const payload = Buffer.from(JSON.stringify(claims())).toString("base64url")
    const walletSig = Buffer.from(
      signWallet(SECRET, NOW, payload),
      "hex"
    ).toString("base64url")
    expect(() => verifyHandoff(`${payload}.${walletSig}`, SECRET, NOW)).toThrow(
      HandoffError
    )
  })
})

describe("wallet signatures", () => {
  it("verifies within the clock window only", () => {
    const body = '{"action":"balance","member_id":1}'
    const sig = signWallet(SECRET, NOW, body)
    expect(verifyWallet(SECRET, NOW, body, sig, NOW + 10)).toBe(true)
    expect(verifyWallet(SECRET, NOW, body + " ", sig, NOW)).toBe(false)
    expect(verifyWallet(SECRET, NOW, body, sig, NOW + 301)).toBe(false)
    expect(verifyWallet(SECRET, NOW, body, "zz", NOW)).toBe(false)
  })

  it("matches the PHP side's documented test vector", () => {
    // includes/hive_studio_lib.php tests the same vector with hash_hmac().
    expect(signWallet("k".repeat(32), 1700000000, "{}")).toBe(
      "962e4a8477b6b84244eb09e603212ee29e91585192a317626c96e3c5b4744b5f"
    )
  })
})
