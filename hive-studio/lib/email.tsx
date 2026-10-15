import "server-only"

import { render } from "@react-email/render"
import { Resend } from "resend"

import MagicLinkEmail, {
  magicLinkSubject,
  magicLinkText,
} from "@/emails/magic-link"
import { requireEnv } from "@/lib/env"

export async function renderMagicLink(url: string, expiresInMinutes: number) {
  const props = { url, expiresInMinutes }
  return {
    subject: magicLinkSubject(),
    html: await render(<MagicLinkEmail {...props} />),
    text: magicLinkText(props),
  }
}

export async function sendMagicLink(
  to: string,
  url: string,
  expiresInMinutes: number
) {
  const { AUTH_RESEND_KEY, EMAIL_FROM } = requireEnv("auth")
  const message = await renderMagicLink(url, expiresInMinutes)
  const { error } = await new Resend(AUTH_RESEND_KEY).emails.send({
    from: EMAIL_FROM,
    to,
    ...message,
  })
  // Never include the URL: it is a one-time sign-in credential.
  if (error) throw new Error(`Resend rejected the sign-in email: ${error.name}`)
}
