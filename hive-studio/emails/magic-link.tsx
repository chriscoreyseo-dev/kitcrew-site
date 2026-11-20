import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email"

import { BRAND } from "@/lib/brand"

export type MagicLinkEmailProps = { url: string; expiresInMinutes: number }

export function magicLinkSubject() {
  return `Sign in to ${BRAND.name}`
}

/** Plain-text version for clients that do not render HTML. */
export function magicLinkText({ url, expiresInMinutes }: MagicLinkEmailProps) {
  return [
    `Sign in to ${BRAND.name}`,
    "",
    "Open this link to sign in:",
    url,
    "",
    `The link works once and expires in ${expiresInMinutes} minutes.`,
    "If you did not ask to sign in, ignore this email.",
    "",
    `Questions? ${BRAND.supportEmail}`,
  ].join("\n")
}

export default function MagicLinkEmail({
  url,
  expiresInMinutes,
}: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ${BRAND.name} sign-in link`}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.background,
          color: "#f2f2f2",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "40px 0",
        }}
      >
        <Container
          style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px" }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: BRAND.primary,
              margin: "0 0 32px",
            }}
          >
            {BRAND.name}
          </Text>
          <Heading
            as="h1"
            style={{
              fontSize: 28,
              lineHeight: "34px",
              fontWeight: 800,
              textTransform: "uppercase",
              margin: "0 0 16px",
            }}
          >
            Your sign-in link
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: "24px", color: "#b5b5b5" }}>
            Tap the button to sign in. No password needed.
          </Text>
          <Section style={{ margin: "28px 0" }}>
            <Button
              href={url}
              style={{
                display: "block",
                backgroundColor: BRAND.primary,
                color: BRAND.primaryText,
                fontSize: 16,
                fontWeight: 800,
                textAlign: "center",
                textTransform: "uppercase",
                borderRadius: 12,
                padding: "16px 24px",
              }}
            >
              {`Sign in to ${BRAND.name}`}
            </Button>
          </Section>
          <Text style={{ fontSize: 13, lineHeight: "20px", color: "#8a8a8a" }}>
            Button not working? Paste this link into your browser:
            <br />
            <Link
              href={url}
              style={{ color: BRAND.primary, wordBreak: "break-all" }}
            >
              {url}
            </Link>
          </Text>
          <Text style={{ fontSize: 13, lineHeight: "20px", color: "#8a8a8a" }}>
            {`The link works once and expires in ${expiresInMinutes} minutes. If you did not ask to sign in, you can ignore this email.`}
          </Text>
          <Hr style={{ borderColor: "#262626", margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 12, color: "#6b6b6b" }}>
            {`Questions? ${BRAND.supportEmail}`}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
