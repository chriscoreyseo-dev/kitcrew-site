import { describe, expect, it } from "vitest"

import { checkEnvAtBoot, EnvError, missingFor, parseEnv } from "@/lib/env"

const full = {
  MONGODB_URI: "mongodb+srv://u:p@cluster.example.net",
  HF_CREDENTIALS: "key_id:key_secret",
  HF_WEBHOOK_SECRET: "x".repeat(32),
  AUTH_SECRET: "secret",
  AUTH_RESEND_KEY: "re_test",
  EMAIL_FROM: "Hive Studio <login@kitcrew.ai>",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  R2_ACCOUNT_ID: "a",
  R2_ACCESS_KEY_ID: "b",
  R2_SECRET_ACCESS_KEY: "c",
  R2_BUCKET: "d",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
  CRON_SECRET: "y".repeat(16),
}

describe("parseEnv", () => {
  it("applies defaults for an empty environment", () => {
    const env = parseEnv({})
    expect(env.HF_API_BASE_URL).toBe("https://api.higgsfield.ai")
    expect(env.CREDIT_MARKUP).toBe(1.5)
    expect(env.CREDIT_USD_VALUE).toBe(0.01)
    expect(env.MONGODB_DB).toBe("hive-studio")
  })

  it("treats blank values from .env.example as unset", () => {
    const env = parseEnv({ HF_CREDENTIALS: "", HF_WEBHOOK_BASE_URL: "  " })
    expect(env.HF_CREDENTIALS).toBeUndefined()
    expect(env.HF_WEBHOOK_BASE_URL).toBeUndefined()
  })

  it("names every malformed variable", () => {
    expect(() =>
      parseEnv({
        HF_CREDENTIALS: "no-colon",
        CREDIT_MARKUP: "0.5",
        APP_URL: "nope",
      })
    ).toThrowError(/HF_CREDENTIALS[\s\S]*APP_URL|APP_URL[\s\S]*HF_CREDENTIALS/)
  })

  it("rejects a short webhook secret", () => {
    expect(() => parseEnv({ HF_WEBHOOK_SECRET: "short" })).toThrow(EnvError)
  })
})

describe("missingFor / checkEnvAtBoot", () => {
  it("lists missing variables per group", () => {
    expect(missingFor(parseEnv({}), "r2")).toHaveLength(5)
    expect(missingFor(parseEnv(full), "r2")).toEqual([])
  })

  it("warns in development and fails in production", () => {
    expect(checkEnvAtBoot({}, false).length).toBeGreaterThan(0)
    expect(() => checkEnvAtBoot({}, true)).toThrow(
      /Missing environment variables/
    )
    expect(checkEnvAtBoot(full, true)).toEqual([])
  })
})
