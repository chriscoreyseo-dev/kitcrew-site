import { describe, expect, it } from "vitest"

import { toAuthorizationHeader } from "@/lib/higgsfield/credentials"

describe("toAuthorizationHeader", () => {
  it("formats the documented Key header", () => {
    expect(toAuthorizationHeader(" abc:def ")).toBe("Key abc:def")
  })

  it("rejects malformed credentials", () => {
    expect(() => toAuthorizationHeader("abc")).toThrow(/key_id:key_secret/)
    expect(() => toAuthorizationHeader("a b:c")).toThrow()
  })
})
