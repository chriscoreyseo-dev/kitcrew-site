import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { checkEnvAtBoot, groupsFor, parseEnv } from "@/lib/env"

describe("deployment mode: env groups (D-055)", () => {
  it("standalone needs auth + stripe, not MarketHive", () => {
    const groups = groupsFor(parseEnv({}))
    expect(groups).toContain("auth")
    expect(groups).toContain("stripe")
    expect(groups).not.toContain("markethive")
  })

  it("markethive needs MarketHive, not Resend or Stripe", () => {
    const groups = groupsFor(parseEnv({ STUDIO_MODE: "markethive" }))
    expect(groups).toContain("markethive")
    expect(groups).not.toContain("auth")
    expect(groups).not.toContain("stripe")
  })

  it("local storage drops R2; the in-process reconciler drops the cron secret", () => {
    const groups = groupsFor(
      parseEnv({ STORAGE_DRIVER: "local", INTERNAL_CRON_SECONDS: "60" })
    )
    expect(groups).not.toContain("r2")
    expect(groups).not.toContain("cron")
  })

  it("a full dev3-shaped environment boots in production", () => {
    expect(
      checkEnvAtBoot(
        {
          STUDIO_MODE: "markethive",
          STORAGE_DRIVER: "local",
          INTERNAL_CRON_SECONDS: "60",
          MONGODB_URI: "mongodb://mongo:27017/?replicaSet=rs0",
          HF_CREDENTIALS: "id:secret",
          HF_WEBHOOK_SECRET: "h".repeat(32),
          MARKETHIVE_BASE_URL: "https://dev3.markethive.com",
          MARKETHIVE_SHARED_SECRET: "m".repeat(32),
        },
        true
      )
    ).toEqual([])
  })

  it("BOOT_REQUIRED_GROUPS lets a half-keyed Docker host boot and report gaps", () => {
    const source = {
      STUDIO_MODE: "markethive",
      STORAGE_DRIVER: "local",
      INTERNAL_CRON_SECONDS: "60",
      MONGODB_URI: "mongodb://mongo:27017/?replicaSet=rs0",
      MARKETHIVE_BASE_URL: "https://dev3.markethive.com",
      MARKETHIVE_SHARED_SECRET: "m".repeat(32),
    }
    expect(() => checkEnvAtBoot(source, true)).toThrow(/HF_CREDENTIALS/)
    const gaps = checkEnvAtBoot(
      { ...source, BOOT_REQUIRED_GROUPS: "db,markethive" },
      true
    )
    expect(gaps.join(" ")).toMatch(/HF_CREDENTIALS/)
    expect(() =>
      checkEnvAtBoot(
        { ...source, MONGODB_URI: "", BOOT_REQUIRED_GROUPS: "db,markethive" },
        true
      )
    ).toThrow(/MONGODB_URI/)
  })

  it("rejects an unknown mode and a short shared secret", () => {
    expect(() => parseEnv({ STUDIO_MODE: "both" })).toThrow()
    expect(() => parseEnv({ MARKETHIVE_SHARED_SECRET: "short" })).toThrow()
  })
})

describe("security headers per mode (D-058)", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("standalone can't be framed by anyone", async () => {
    vi.stubEnv("STUDIO_MODE", "standalone")
    const { securityHeaders } = await import("@/proxy")
    const headers = securityHeaders()
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'"
    )
    expect(headers["X-Frame-Options"]).toBe("DENY")
  })

  it("markethive mode is framable only by MarketHive's origins", async () => {
    vi.stubEnv("STUDIO_MODE", "markethive")
    vi.stubEnv(
      "MARKETHIVE_FRAME_ANCESTORS",
      "https://markethive.com https://dev3.markethive.com javascript:alert(1) *"
    )
    vi.stubEnv("APP_URL", "https://studio.example.com")
    const { securityHeaders } = await import("@/proxy")
    const headers = securityHeaders()
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors https://markethive.com https://dev3.markethive.com;"
    )
    expect(headers["X-Frame-Options"]).toBeUndefined()
    expect(headers["Strict-Transport-Security"]).toBeDefined()
  })
})

describe("local storage driver (D-059)", () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("only serves exact output keys and never escapes the volume", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "hive-media-"))
    vi.stubEnv("LOCAL_STORAGE_DIR", dir)
    const { localPath } = await import("@/lib/storage/local")
    const good = `u/${"a".repeat(24)}/${"b".repeat(24)}/0.png`
    expect(localPath(good).startsWith(dir)).toBe(true)
    for (const bad of [
      "../etc/passwd",
      `u/${"a".repeat(24)}/../../x/0.png`,
      `u/${"a".repeat(24)}/${"b".repeat(24)}/0.php`,
    ])
      expect(() => localPath(bad)).toThrow()
  })

  it("downloads an output into the volume and returns a /media URL", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "hive-media-"))
    vi.stubEnv("LOCAL_STORAGE_DIR", dir)
    vi.stubEnv("APP_URL", "https://studio.example.com")
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "image/webp" },
          })
      )
    )
    const { copyToLocal } = await import("@/lib/storage/local")
    const out = await copyToLocal({
      sourceUrl: "https://cdn.example.com/x.webp",
      userId: "a".repeat(24),
      generationId: "b".repeat(24),
      index: 1,
      kind: "image",
    })
    expect(out.url).toBe(
      `https://studio.example.com/media/u/${"a".repeat(24)}/${"b".repeat(24)}/1.webp`
    )
    expect(out.bytes).toBe(3)
    expect([
      ...readFileSync(
        path.join(dir, "u", "a".repeat(24), "b".repeat(24), "1.webp")
      ),
    ]).toEqual([1, 2, 3])
  })

  it("refuses plain-http sources unless the E2E flag allows localhost", async () => {
    const { assertOutputSource } = await import("@/lib/storage/keys")
    expect(() => assertOutputSource("http://127.0.0.1:4010/x.png")).toThrow()
    vi.stubEnv("E2E_ALLOW_HTTP_OUTPUTS", "1")
    expect(assertOutputSource("http://127.0.0.1:4010/x.png").port).toBe("4010")
    expect(() => assertOutputSource("http://evil.example/x.png")).toThrow()
  })
})
