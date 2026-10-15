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

  R2_ACCOUNT_ID: nonEmpty.optional(),
  R2_ACCESS_KEY_ID: nonEmpty.optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty.optional(),
  R2_BUCKET: nonEmpty.optional(),
  R2_PUBLIC_BASE_URL: url.optional(),

  CRON_SECRET: z.string().min(16).optional(),

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
export function checkEnvAtBoot(
  source: Record<string, string | undefined> = process.env,
  production = source.NODE_ENV === "production"
): string[] {
  const parsed = parseEnv(source)
  const gaps = (Object.keys(ENV_GROUPS) as EnvGroup[])
    .map((group) => ({ group, missing: missingFor(parsed, group) }))
    .filter(({ missing }) => missing.length > 0)
    .map(({ group, missing }) => `${group}: ${missing.join(", ")}`)
  if (gaps.length && production)
    throw new EnvError(
      `Missing environment variables:\n  - ${gaps.join("\n  - ")}`
    )
  return gaps
}
