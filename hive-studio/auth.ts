import { MongoDBAdapter } from "@auth/mongodb-adapter"
import { ObjectId } from "mongodb"
import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"

import { MAGIC_LINK_MINUTES, normalizeEmail } from "@/lib/auth-email"
import { grantCredits } from "@/lib/billing/ledger"
import { db, mongoClient } from "@/lib/db/mongo"
import { sendMagicLink } from "@/lib/email"
import { requireEnv } from "@/lib/env"
import { clientIp, hitAll, MAGIC_LINK_LIMITS } from "@/lib/rate-limit"

export class MagicLinkRateLimitError extends Error {
  constructor() {
    super("Too many sign-in emails. Try again later.")
    this.name = "MagicLinkRateLimitError"
  }
}

/** Config is built per request so builds and keyless dev boots don't need env. */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = requireEnv("auth")
  const { MONGODB_DB } = requireEnv("db")
  return {
    secret: env.AUTH_SECRET,
    trustHost: true,
    adapter: MongoDBAdapter(() => mongoClient().connect(), {
      databaseName: MONGODB_DB,
    }),
    session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
    pages: {
      signIn: "/login",
      verifyRequest: "/login/check-email",
      error: "/login/error",
    },
    providers: [
      Resend({
        apiKey: env.AUTH_RESEND_KEY,
        from: env.EMAIL_FROM,
        maxAge: MAGIC_LINK_MINUTES * 60,
        normalizeIdentifier: normalizeEmail,
        // Enforced here, not only in the form action: the provider endpoint
        // (/api/auth/signin/resend) can be called directly.
        async sendVerificationRequest({ identifier, url, request }) {
          const limit = await hitAll(
            MAGIC_LINK_LIMITS(identifier, clientIp(request.headers))
          )
          if (!limit.ok) throw new MagicLinkRateLimitError()
          await sendMagicLink(identifier, url, MAGIC_LINK_MINUTES)
        },
      }),
    ],
    callbacks: {
      // Only id and role reach the client. Never the credit balance: it would go stale.
      session({ session, user }) {
        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            role: user.role === "admin" ? "admin" : "user",
          },
        }
      },
    },
    events: {
      async createUser({ user }) {
        if (!user.id) return
        await db()
          .collection("users")
          .updateOne(
            { _id: new ObjectId(user.id) },
            {
              $set: { role: "user", createdAt: new Date() },
              $min: { "credits.subscription": 0, "credits.topup": 0 },
            }
          )
        const bonus = requireEnv("auth").SIGNUP_BONUS_CREDITS
        if (bonus > 0)
          await grantCredits({
            userId: user.id,
            amount: bonus,
            bucket: "topup",
            reason: "signup_bonus",
            refType: "user",
            refId: user.id,
          })
      },
    },
  }
})
