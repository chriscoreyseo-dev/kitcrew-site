import { createHmac, timingSafeEqual } from "node:crypto"

/** The two signatures shared with MarketHive (D-056). One secret, two
    purposes kept apart by a fixed prefix, so a handoff token can never be
    replayed as a wallet call or the other way round. Mirrored byte for byte
    by includes/hive_studio_lib.php on the MarketHive side. */

export const HANDOFF_PREFIX = "hive-studio-handoff.v1."
export const WALLET_PREFIX = "hive-studio-wallet.v1\n"

/** Tokens older than this are refused even if MarketHive set a later exp. */
export const HANDOFF_MAX_AGE_SEC = 120
/** Wallet calls must be signed within this many seconds of our clock. */
export const WALLET_SKEW_SEC = 300

export type HandoffClaims = {
  v: 1
  /** MarketHive MEMBERS.USER_ID */
  mid: number
  email: string
  name: string
  /** MEMBERS.IS_ADMIN = 1 */
  admin: boolean
  iat: number
  exp: number
  /** Single use: a token can open one session, once. */
  nonce: string
}

export class HandoffError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HandoffError"
  }
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest()
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Test and mock helper: what MarketHive's launcher produces. */
export function signHandoff(claims: HandoffClaims, secret: string): string {
  const payload = b64url(JSON.stringify(claims))
  return `${payload}.${b64url(hmac(secret, HANDOFF_PREFIX + payload))}`
}

export function verifyHandoff(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000)
): HandoffClaims {
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1])
    throw new HandoffError("Malformed sign-in link.")
  const [payload, signature] = parts as [string, string]
  const expected = hmac(secret, HANDOFF_PREFIX + payload)
  if (!safeEqual(Buffer.from(signature, "base64url"), expected))
    throw new HandoffError("This sign-in link isn't valid.")
  let claims: Partial<HandoffClaims>
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    throw new HandoffError("Malformed sign-in link.")
  }
  if (
    claims.v !== 1 ||
    !Number.isInteger(claims.mid) ||
    (claims.mid ?? 0) <= 0 ||
    typeof claims.email !== "string" ||
    typeof claims.name !== "string" ||
    typeof claims.nonce !== "string" ||
    claims.nonce.length < 16 ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number"
  )
    throw new HandoffError("Malformed sign-in link.")
  if (claims.exp < nowSec || claims.iat > nowSec + 30)
    throw new HandoffError("This sign-in link has expired.")
  if (nowSec - claims.iat > HANDOFF_MAX_AGE_SEC)
    throw new HandoffError("This sign-in link has expired.")
  return {
    v: 1,
    mid: claims.mid as number,
    email: claims.email.trim().toLowerCase(),
    name: claims.name.slice(0, 120),
    admin: claims.admin === true,
    iat: claims.iat,
    exp: claims.exp,
    nonce: claims.nonce,
  }
}

/** Signature for a wallet call: HMAC(secret, prefix + ts + "\n" + body), hex. */
export function signWallet(secret: string, ts: number, body: string): string {
  return hmac(secret, `${WALLET_PREFIX}${ts}\n${body}`).toString("hex")
}

export function verifyWallet(
  secret: string,
  ts: number,
  body: string,
  signature: string,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > WALLET_SKEW_SEC)
    return false
  if (!/^[0-9a-f]{64}$/.test(signature)) return false
  return safeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(signWallet(secret, ts, body), "hex")
  )
}
