import { describe, expect, it } from "vitest"

import { AuthEmailError, normalizeEmail, safeRedirect } from "@/lib/auth-email"

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Chris@KitCrew.AI ")).toBe("chris@kitcrew.ai")
  })

  it("rejects malformed or multiple addresses", () => {
    for (const bad of [
      "",
      "nope",
      "a@b",
      "a@b.com,c@d.com",
      "a b@c.com",
      "a@b.com;c@d.com",
    ])
      expect(() => normalizeEmail(bad), bad).toThrow(AuthEmailError)
  })

  it("rejects disposable domains", () => {
    expect(() => normalizeEmail("x@mailinator.com")).toThrow(/permanent/)
  })
})

describe("safeRedirect", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirect("/video?model=kling-3")).toBe("/video?model=kling-3")
  })

  it("rejects external and protocol-relative targets", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      42,
      null,
    ])
      expect(safeRedirect(bad)).toBe("/")
  })
})
