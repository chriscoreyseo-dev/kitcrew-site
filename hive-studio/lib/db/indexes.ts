import type { CreateIndexesOptions, Db, IndexSpecification } from "mongodb"

/** Every index the app relies on (build spec §6). `ensureIndexes` is safe to
    run repeatedly: createIndex is a no-op when an identical index exists.
    Names are explicit so a changed definition fails loudly instead of
    silently creating a second index. */

export type IndexDef = {
  collection: string
  key: IndexSpecification
  options: CreateIndexesOptions & { name: string }
}

export const INDEXES: readonly IndexDef[] = [
  // Auth.js MongoDB adapter collections.
  {
    collection: "users",
    key: { email: 1 },
    options: { name: "email_unique", unique: true, sparse: true },
  },
  {
    collection: "users",
    key: { stripeCustomerId: 1 },
    options: { name: "stripe_customer_unique", unique: true, sparse: true },
  },
  {
    collection: "accounts",
    key: { provider: 1, providerAccountId: 1 },
    options: { name: "provider_account_unique", unique: true },
  },
  { collection: "accounts", key: { userId: 1 }, options: { name: "user" } },
  {
    collection: "sessions",
    key: { sessionToken: 1 },
    options: { name: "session_token_unique", unique: true },
  },
  {
    collection: "sessions",
    key: { expires: 1 },
    options: { name: "expires_ttl", expireAfterSeconds: 0 },
  },
  {
    collection: "verification_tokens",
    key: { identifier: 1, token: 1 },
    options: { name: "identifier_token_unique", unique: true },
  },
  {
    collection: "verification_tokens",
    key: { expires: 1 },
    options: { name: "expires_ttl", expireAfterSeconds: 0 },
  },

  // Generations.
  {
    collection: "generations",
    key: { userId: 1, createdAt: -1 },
    options: { name: "user_recent" },
  },
  {
    collection: "generations",
    key: { hfRequestId: 1 },
    options: { name: "hf_request_unique", unique: true, sparse: true },
  },
  {
    collection: "generations",
    key: { userId: 1, clientRequestId: 1 },
    options: { name: "client_request_unique", unique: true },
  },
  {
    collection: "generations",
    key: { status: 1, checkedAt: 1 },
    options: { name: "status_checked" },
  },
  {
    collection: "generations",
    key: { status: 1, updatedAt: 1 },
    options: { name: "status_updated" },
  },
  {
    collection: "generations",
    key: { isPublic: 1, publishedAt: -1 },
    options: { name: "public_feed" },
  },

  {
    collection: "projects",
    key: { userId: 1, updatedAt: -1 },
    options: { name: "user_recent" },
  },
  {
    collection: "uploads",
    key: { userId: 1, createdAt: -1 },
    options: { name: "user_recent" },
  },
  {
    collection: "uploads",
    key: { userId: 1, publicUrl: 1 },
    options: { name: "user_url" },
  },
  {
    collection: "generations",
    key: { userId: 1, "outputs.url": 1 },
    options: { name: "user_output_url" },
  },

  // Credits: the unique triple makes every grant, debit and refund idempotent.
  {
    collection: "credit_ledger",
    key: { reason: 1, refType: 1, refId: 1 },
    options: { name: "ref_unique", unique: true },
  },
  {
    collection: "credit_ledger",
    key: { userId: 1, createdAt: -1 },
    options: { name: "user_recent" },
  },

  // Webhook dedupe (stripe_events dedupes on _id = event.id, no extra index).
  {
    collection: "hf_webhook_events",
    key: { requestId: 1, status: 1 },
    options: { name: "request_status_unique", unique: true },
  },

  {
    collection: "topup_purchases",
    key: { paymentIntent: 1 },
    options: { name: "payment_intent", unique: true, sparse: true },
  },
  {
    collection: "users",
    key: { stripeSubscriptionId: 1 },
    options: { name: "stripe_subscription", sparse: true },
  },
  {
    collection: "generations",
    key: { status: 1, createdAt: -1 },
    options: { name: "admin_status_recent" },
  },
  {
    collection: "generations",
    key: { modelId: 1, createdAt: -1 },
    options: { name: "admin_model_recent" },
  },
  {
    collection: "generations",
    key: { createdAt: -1 },
    options: { name: "admin_recent" },
  },
  {
    collection: "reports",
    key: { status: 1, createdAt: -1 },
    options: { name: "queue" },
  },
  {
    collection: "users",
    key: { createdAt: -1 },
    options: { name: "admin_recent" },
  },
  {
    collection: "presets",
    key: { slug: 1 },
    options: { name: "slug_unique", unique: true },
  },
  {
    collection: "model_pricing",
    key: { modelId: 1 },
    options: { name: "model_unique", unique: true },
  },
  {
    collection: "rate_limits",
    key: { key: 1 },
    options: { name: "key_unique", unique: true },
  },
  {
    collection: "rate_limits",
    key: { expiresAt: 1 },
    options: { name: "expires_ttl", expireAfterSeconds: 0 },
  },
  {
    collection: "reports",
    key: { reporterId: 1, generationId: 1 },
    options: {
      name: "open_report_unique",
      unique: true,
      partialFilterExpression: { status: "open" },
    },
  },
  {
    collection: "generations",
    key: { isPublic: 1, status: 1, publishedAt: -1, _id: -1 },
    options: { name: "community_feed" },
  },
  {
    collection: "reports",
    key: { generationId: 1 },
    options: { name: "generation" },
  },
  // markethive mode (D-056): members are keyed by MarketHive USER_ID; studio
  // sessions and single-use handoff nonces expire on their own.
  {
    collection: "users",
    key: { "markethive.memberId": 1 },
    options: { name: "markethive_member_unique", unique: true, sparse: true },
  },
  {
    collection: "mh_sessions",
    key: { tokenHash: 1 },
    options: { name: "token_unique", unique: true },
  },
  {
    collection: "mh_sessions",
    key: { expires: 1 },
    options: { name: "expires_ttl", expireAfterSeconds: 0 },
  },
  {
    collection: "handoff_nonces",
    key: { usedAt: 1 },
    options: { name: "used_ttl", expireAfterSeconds: 24 * 60 * 60 },
  },
  // Undelivered MarketHive refunds, retried by the reconciler (D-057).
  {
    collection: "generations",
    key: { walletRefundPending: 1 },
    options: { name: "wallet_refund_pending", sparse: true },
  },
]

export async function ensureIndexes(
  database: Pick<Db, "collection">,
  log: (line: string) => void = () => {}
): Promise<number> {
  for (const index of INDEXES) {
    await database
      .collection(index.collection)
      .createIndex(index.key, index.options)
    log(`ok  ${index.collection}.${index.options.name}`)
  }
  return INDEXES.length
}
