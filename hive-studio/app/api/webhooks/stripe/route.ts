import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { handleStripeEvent } from "@/lib/billing/stripe-events"
import { stripeEffects } from "@/lib/billing/stripe-effects"
import { db } from "@/lib/db/mongo"
import { requireEnv } from "@/lib/env"
import { isMarketHive } from "@/lib/mode"
import { stripe } from "@/lib/stripe"

export const runtime = "nodejs"

type EventDoc = {
  _id: string
  type: string
  status: "processing" | "done"
  result?: string
  receivedAt: Date
}

/** Raw body → signature check → dedupe on event.id → handle. A failure
    removes the dedupe record and answers 500 so Stripe retries. */
export async function POST(request: Request) {
  // No Stripe in markethive mode (S566-DRL-01).
  if (isMarketHive()) return new NextResponse("Not found", { status: 404 })
  const signature = request.headers.get("stripe-signature")
  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature ?? "",
      requireEnv("stripe").STRIPE_WEBHOOK_SECRET
    )
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  const events = db().collection<EventDoc>("stripe_events")
  try {
    await events.insertOne({
      _id: event.id,
      type: event.type,
      status: "processing",
      receivedAt: new Date(),
    })
  } catch (error) {
    if ((error as { code?: unknown })?.code === 11000)
      return NextResponse.json({ ok: true, duplicate: true })
    throw error
  }

  try {
    const result = await handleStripeEvent(event, stripeEffects())
    await events.updateOne(
      { _id: event.id },
      { $set: { status: "done", result } }
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    await events.deleteOne({ _id: event.id })
    console.error("[stripe] event failed", {
      id: event.id,
      type: event.type,
      error: String(error),
    })
    return NextResponse.json({ error: "processing failed" }, { status: 500 })
  }
}
