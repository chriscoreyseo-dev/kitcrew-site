import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"

import { memberIdOf } from "@/lib/billing/wallet"
import { env } from "@/lib/env"
import { boostQuote, WalletUnavailableError } from "@/lib/markethive/wallet"
import { currentUser } from "@/lib/session"

/** What a Boost costs the signed-in member right now (S584): Boosts they hold,
    MarketHive's live price, their Vault balance - shown before they confirm a
    Post + Boost. Read only; markethive mode only. */
export async function GET() {
  if (env().STUDIO_MODE !== "markethive")
    return NextResponse.json({ error: "Not available." }, { status: 404 })
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  try {
    const quote = await boostQuote(await memberIdOf(new ObjectId(user.id)))
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof WalletUnavailableError)
      return NextResponse.json({ error: error.message }, { status: 503 })
    throw error
  }
}
