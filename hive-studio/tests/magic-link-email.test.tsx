import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import MagicLinkEmail, {
  magicLinkSubject,
  magicLinkText,
} from "@/emails/magic-link"

const url =
  "https://studio.kitcrew.ai/api/auth/callback/resend?token=abc&email=a%40b.com"

describe("magic link email", () => {
  it("renders the branded button, fallback link and expiry", async () => {
    const html = await render(
      <MagicLinkEmail url={url} expiresInMinutes={30} />
    )
    expect(html).toContain("Sign in to Hive Studio")
    expect(
      html.split(url.replace(/&/g, "&amp;")).length - 1
    ).toBeGreaterThanOrEqual(2)
    expect(html).toContain("expires in 30 minutes")
  })

  it("has a plain-text version and subject", () => {
    expect(magicLinkSubject()).toBe("Sign in to Hive Studio")
    const text = magicLinkText({ url, expiresInMinutes: 30 })
    expect(text).toContain(url)
    expect(text).toContain("30 minutes")
  })
})
