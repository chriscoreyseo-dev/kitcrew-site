import { describe, expect, it } from "vitest"

import { isSameOrigin } from "@/lib/same-origin"

const PUBLIC = "https://hive-studio.49.13.93.22.sslip.io"
// What Next.js sees inside the container behind Coolify's proxy.
const INTERNAL = "http://0.0.0.0:3000/api/upload"

describe("isSameOrigin", () => {
  it("accepts the public studio origin behind a proxy", () => {
    expect(isSameOrigin(PUBLIC, INTERNAL, PUBLIC)).toBe(true)
  })

  it("accepts the request's own origin in local development", () => {
    expect(
      isSameOrigin(
        "http://localhost:3000",
        "http://localhost:3000/api/upload",
        "http://localhost:3000"
      )
    ).toBe(true)
  })

  it("passes a request with no Origin header", () => {
    expect(isSameOrigin(null, INTERNAL, PUBLIC)).toBe(true)
  })

  it("refuses another site", () => {
    expect(isSameOrigin("https://markethive.com", INTERNAL, PUBLIC)).toBe(false)
    expect(isSameOrigin("https://evil.example", INTERNAL, PUBLIC)).toBe(false)
  })

  it("refuses http when the studio is https", () => {
    expect(
      isSameOrigin("http://hive-studio.49.13.93.22.sslip.io", INTERNAL, PUBLIC)
    ).toBe(false)
  })

  it("survives an unparseable APP_URL", () => {
    expect(isSameOrigin(PUBLIC, INTERNAL, "not a url")).toBe(false)
  })
})
