import "server-only"

import { z } from "zod"

/** Server environment. Secrets are set by the operator (Vercel / local .env),
    never committed. Each feature reads its own group through `requireEnv`, so a
    missing value fails with a message that names it; `checkEnvAtBoot` reports
    every gap at once when the server starts. */

const nonEmpty = z.string().trim().min(1)
const url = z.url()

const credentials = nonEmpty.regex(
  /^[^\s:]+:[^\s:]+$/,
  "must be key_id:key_secret"
)

const schema = z.object({
  /** Deploy-time switch (D-055). "standalone" = studio.kitcrew.ai: magic-link
      sign-in + Stripe credits. "markethive" = inside MarketHive: sign-in by a
      signed MarketHive handoff, paid in Hive credits held by MarketHive. */
  STUDIO_MODE: z.enum(["standalone", "markethive"]).default("standalone"),

  APP_URL: url.default("http://localhost:3000"),
  NEXT_PUBLIC_BRAND_NAME: nonEmpty.default("Hive Studio"),

  AUTH_SECRET: nonEmpty.optional(),
  AUTH_URL: url.optional(),
  AUTH_RESEND_KEY: nonEmpty.optional(),
  EMAIL_FROM: nonEmpty.optional(),
  SIGNUP_BONUS_CREDITS: z.coerce.number().int().min(0).default(0),

  MONGODB_URI: nonEmpty.optional(),
  MONGODB_DB: nonEmpty.default("hive-studio"),

  HF_API_BASE_URL: url.default("https://api.higgsfield.ai"),
  HF_CREDENTIALS: credentials.optional(),
  HF_WEBHOOK_SECRET: z.string().min(32).optional(),
  HF_WEBHOOK_BASE_URL: url.optional(),

  CREDIT_USD_VALUE: z.coerce.number().positive().default(0.01),
  CREDIT_MARKUP: z.coerce.number().min(1).default(1.5),

  STRIPE_SECRET_KEY: nonEmpty.optional(),
  STRIPE_WEBHOOK_SECRET: nonEmpty.optional(),
  STRIPE_PRICE_STARTER_MONTHLY: nonEmpty.optional(),
  STRIPE_PRICE_STARTER_ANNUAL: nonEmpty.optional(),
  STRIPE_PRICE_PLUS_MONTHLY: nonEmpty.optional(),
  STRIPE_PRICE_PLUS_ANNUAL: nonEmpty.optional(),
  STRIPE_PRICE_ULTRA_MONTHLY: nonEmpty.optional(),
  STRIPE_PRICE_ULTRA_ANNUAL: nonEmpty.optional(),
  STRIPE_PRICE_TOPUP_SMALL: nonEmpty.optional(),
  STRIPE_PRICE_TOPUP_MEDIUM: nonEmpty.optional(),
  STRIPE_PRICE_TOPUP_LARGE: nonEmpty.optional(),

  R2_ACCOUNT_ID: nonEmpty.optional(),
  R2_ACCESS_KEY_ID: nonEmpty.optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty.optional(),
  R2_BUCKET: nonEmpty.optional(),
  R2_PUBLIC_BASE_URL: url.optional(),

  CRON_SECRET: z.string().min(16).optional(),
  /** Run the reconciler inside the server process every N seconds (Docker
      hosts without Vercel Cron). 0 = off. */
  INTERNAL_CRON_SECONDS: z.coerce.number().int().min(0).default(0),

  /** Where finished outputs are kept: Cloudflare R2, or a local volume served
      by /media (single-host Docker, e.g. MarketHive dev3). */
  STORAGE_DRIVER: z.enum(["r2", "local"]).default("r2"),
  LOCAL_STORAGE_DIR: nonEmpty.default("/data/media"),

  /** MarketHive mode. The base URL of the MarketHive site whose wallet and
      sign-in this studio uses, and the secret both sides share (set by the
      operator on both servers, never committed). */
  MARKETHIVE_BASE_URL: url.optional(),
  MARKETHIVE_SHARED_SECRET: z.string().min(32).optional(),
  /** Space-separated origins allowed to frame the studio (CSP frame-ancestors). */
  MARKETHIVE_FRAME_ANCESTORS: nonEmpty.default(
    "https://markethive.com https://www.markethive.com https://dev3.markethive.com"
  ),
  /** Where "Add credits" sends a member (MarketHive's own wallet page). */
  MARKETHIVE_CREDITS_URL: url.optional(),
  /** MarketHive mode prices every run from Higgsfield's cost (S577-DRL-02):
      MarketHive credits (dollars) = Higgsfield list USD x this markup. 1.5 =
      50% over cost, MarketHive's margin for its AI doing the creative work
      (S580-DRL-02, Chris). Same on dev3 and production. */
  MARKETHIVE_MARKUP: z.coerce.number().min(1).default(1.5),

  /** AI prompt writer (S611): MarketHive's OpenAI proxy (the one AI Blog
      Autopilot uses; its MH_OPENAI_PROXY_URL / _TOKEN). Unset = the "Write the
      prompt for me" button says it isn't set up yet. */
  OPENAI_PROXY_URL: url.optional(),
  OPENAI_PROXY_TOKEN: nonEmpty.optional(),
  /** Which of the proxy's keys to spend (X-Proxy-Key) and which allow-listed model. */
  OPENAI_PROXY_KEY: nonEmpty.default("blog"),
  RECIPE_MODEL: nonEmpty.default("gpt-5-nano"),

  /** Who may spend the platform key in production. "admins" until billing
      ships (Phase 5); then "everyone". Development is always open to
      signed-in users. */
  GENERATION_ACCESS: z.enum(["admins", "everyone"]).default("admins"),
})

export type Env = z.infer<typeof schema>
type Key = keyof Env

/** Feature groups and the variables each one cannot run without. */
export const ENV_GROUPS = {
  db: ["MONGODB_URI"],
  higgsfield: ["HF_CREDENTIALS"],
  webhooks: ["HF_WEBHOOK_SECRET"],
  auth: ["AUTH_SECRET", "AUTH_RESEND_KEY", "EMAIL_FROM"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  r2: [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ],
  cron: ["CRON_SECRET"],
  markethive: ["MARKETHIVE_BASE_URL", "MARKETHIVE_SHARED_SECRET"],
  recipes: ["OPENAI_PROXY_URL", "OPENAI_PROXY_TOKEN"],
} as const satisfies Record<string, readonly Key[]>

export type EnvGroup = keyof typeof ENV_GROUPS

export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EnvError"
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  // A blank line copied from .env.example means "not set", not "empty value".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => value !== undefined && value.trim() !== ""
    )
  )
  const result = schema.safeParse(cleaned)
  if (result.success) return result.data
  const lines = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`
  )
  throw new EnvError(`Invalid environment:\n${lines.join("\n")}`)
}

export function missingFor(env: Env, group: EnvGroup): Key[] {
  return ENV_GROUPS[group].filter((key) => env[key] === undefined)
}

let cached: Env | undefined

export function env(): Env {
  cached ??= parseEnv(process.env)
  return cached
}

/** The environment with `group` guaranteed present, or a clear error. */
export function requireEnv<G extends EnvGroup>(
  group: G
): Env & { [K in (typeof ENV_GROUPS)[G][number]]-?: NonNullable<Env[K]> } {
  const current = env()
  const missing = missingFor(current, group)
  if (missing.length)
    throw new EnvError(
      `Missing ${missing.join(", ")} (needed for ${group}). See .env.example.`
    )
  return current as Env & {
    [K in (typeof ENV_GROUPS)[G][number]]-?: NonNullable<Env[K]>
  }
}

/** Called from instrumentation on server start. Malformed values always fail.
    Missing groups fail in production and are listed as warnings in development,
    so the studio still boots while integrations are added phase by phase. */
/** The groups a deployment needs. Each mode drops the other's sign-in and
    wallet; local storage drops R2; an in-process reconciler drops the cron secret. */
export function groupsFor(e: Env): EnvGroup[] {
  const skip = new Set<EnvGroup>(
    e.STUDIO_MODE === "markethive" ? ["auth", "stripe"] : ["markethive"]
  )
  if (e.STORAGE_DRIVER === "local") skip.add("r2")
  if (e.INTERNAL_CRON_SECONDS > 0) skip.add("cron")
  // Optional feature (S611): never blocks a boot; the button checks at use.
  skip.add("recipes")
  return (Object.keys(ENV_GROUPS) as EnvGroup[]).filter((g) => !skip.has(g))
}

export function checkEnvAtBoot(
  source: Record<string, string | undefined> = process.env,
  production = source.NODE_ENV === "production"
): string[] {
  const parsed = parseEnv(source)
  const missing = groupsFor(parsed)
    .map((group) => ({ group, missing: missingFor(parsed, group) }))
    .filter(({ missing }) => missing.length > 0)
  const gaps = missing.map(
    ({ group, missing }) => `${group}: ${missing.join(", ")}`
  )
  // BOOT_REQUIRED_GROUPS narrows what stops a production boot (D-061), e.g.
  // "db,markethive" while an operator is still adding keys on a Docker host.
  // Every feature still refuses at use through requireEnv, so nothing runs
  // half-configured; the server just stays up to say what is missing.
  const required = source.BOOT_REQUIRED_GROUPS?.trim()
    ? new Set(source.BOOT_REQUIRED_GROUPS.split(",").map((g) => g.trim()))
    : null
  const fatal = missing
    .filter(({ group }) => !required || required.has(group))
    .map(({ group, missing }) => `${group}: ${missing.join(", ")}`)
  if (fatal.length && production)
    throw new EnvError(
      `Missing environment variables:\n  - ${fatal.join("\n  - ")}`
    )
  return gaps
}
