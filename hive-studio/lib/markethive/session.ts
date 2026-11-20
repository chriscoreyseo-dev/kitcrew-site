import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { MongoServerError, ObjectId } from "mongodb"

import { db } from "@/lib/db/mongo"
import type { Role } from "@/types/next-auth"

import { HandoffError } from "./signing"
import type { HandoffClaims } from "./signing"

/** markethive mode sign-in (D-056). MarketHive's launcher signs a short-lived
    token; /auth/markethive verifies it, spends its nonce and opens a studio
    session. The session is ours (an opaque cookie, hashed at rest), not
    Auth.js's: there is no email step and no Auth.js account in this mode.

    The cookie is SameSite=None; Secure; Partitioned so it works inside
    MarketHive's overlay iframe (a third-party context) without becoming a
    cross-site tracking cookie: browsers keep it in a jar keyed to MarketHive. */

export const MH_SESSION_COOKIE = "hive_mh_session"
export const MH_SESSION_HOURS = 12

type UserDoc = {
  _id: ObjectId
  email?: string
  name?: string
  role?: Role
  markethive?: { memberId: number; email: string; name: string }
  credits?: { subscription: number; topup: number }
  createdAt?: Date
  lastHandoffAt?: Date
}

type SessionDoc = {
  _id: ObjectId
  tokenHash: string
  userId: ObjectId
  expires: Date
  createdAt: Date
}

const users = () => db().collection<UserDoc>("users")
const sessions = () => db().collection<SessionDoc>("mh_sessions")
const nonces = () =>
  db().collection<{ _id: string; usedAt: Date; memberId: number }>(
    "handoff_nonces"
  )

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

function isDuplicate(error: unknown): boolean {
  return (
    (error instanceof MongoServerError && error.code === 11000) ||
    (error as { code?: unknown })?.code === 11000
  )
}

/** Find or create the studio user for a MarketHive member. Role follows
    MarketHive's IS_ADMIN on every sign-in, so revoking it there revokes it here. */
async function upsertMember(claims: HandoffClaims): Promise<ObjectId> {
  const now = new Date()
  const role: Role = claims.admin ? "admin" : "user"
  const profile = {
    memberId: claims.mid,
    email: claims.email,
    name: claims.name,
  }
  const update = (withEmail: boolean) =>
    users().findOneAndUpdate(
      { "markethive.memberId": claims.mid },
      {
        $set: {
          markethive: profile,
          name: claims.name,
          role,
          lastHandoffAt: now,
          ...(withEmail ? { email: claims.email } : {}),
        },
        $setOnInsert: {
          createdAt: now,
          credits: { subscription: 0, topup: 0 },
        },
      },
      { upsert: true, returnDocument: "after", projection: { _id: 1 } }
    )
  let doc: Pick<UserDoc, "_id"> | null
  try {
    doc = await update(true)
  } catch (error) {
    // Two MarketHive accounts can share an address; the member id is the key.
    if (!isDuplicate(error)) throw error
    doc = await update(false)
  }
  if (!doc) throw new Error("Could not create the studio account")
  return doc._id
}

export async function startMarketHiveSession(
  claims: HandoffClaims
): Promise<{ token: string; expires: Date; userId: string }> {
  try {
    await nonces().insertOne({
      _id: claims.nonce,
      usedAt: new Date(),
      memberId: claims.mid,
    })
  } catch (error) {
    if (isDuplicate(error))
      throw new HandoffError(
        "This sign-in link was already used. Open Hive Studio from MarketHive again."
      )
    throw error
  }
  const userId = await upsertMember(claims)
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expires = new Date(now.getTime() + MH_SESSION_HOURS * 3600_000)
  await sessions().insertOne({
    _id: new ObjectId(),
    tokenHash: hashToken(token),
    userId,
    expires,
    createdAt: now,
  })
  return { token, expires, userId: userId.toHexString() }
}

export async function marketHiveSessionUser(
  token: string | undefined
): Promise<{ id: string; email: string; role: Role } | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const session = await sessions().findOne({
    tokenHash: hashToken(token),
    expires: { $gt: new Date() },
  })
  if (!session) return null
  const user = await users().findOne(
    { _id: session.userId },
    { projection: { email: 1, role: 1, markethive: 1 } }
  )
  if (!user) return null
  return {
    id: user._id.toHexString(),
    email: user.email ?? user.markethive?.email ?? "",
    role: user.role === "admin" ? "admin" : "user",
  }
}

export async function endMarketHiveSession(
  token: string | undefined
): Promise<void> {
  if (!token) return
  await sessions().deleteOne({ tokenHash: hashToken(token) })
}
