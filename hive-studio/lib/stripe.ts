import "server-only"

import Stripe from "stripe"

import { requireEnv } from "@/lib/env"

let client: Stripe | undefined

/** Server-only Stripe client (API version pinned by the SDK). */
export function stripe(): Stripe {
  client ??= new Stripe(requireEnv("stripe").STRIPE_SECRET_KEY, {
    appInfo: { name: "Hive Studio" },
    maxNetworkRetries: 2,
  })
  return client
}
