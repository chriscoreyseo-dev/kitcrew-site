import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "react-email"

import { BRAND } from "@/lib/brand"

export type CreditsAddedProps = {
  credits: number
  balance: number
  accountUrl: string
}

export function creditsAddedSubject(credits: number) {
  return `${credits.toLocaleString("en-US")} credits added to ${BRAND.name}`
}

export function creditsAddedText({
  credits,
  balance,
  accountUrl,
}: CreditsAddedProps) {
  return [
    `${credits.toLocaleString("en-US")} credits were added to your ${BRAND.name} account.`,
    `New balance: ${balance.toLocaleString("en-US")} credits.`,
    "",
    `Account and receipts: ${accountUrl}`,
    `Questions? ${BRAND.supportEmail}`,
  ].join("\n")
}

export default function CreditsAddedEmail(props: CreditsAddedProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{creditsAddedSubject(props.credits)}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.background,
          color: "#f2f2f2",
          fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
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
            }}
          >
            {BRAND.name}
          </Text>
          <Heading
            as="h1"
            style={{
              fontSize: 28,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            {`✦ ${props.credits.toLocaleString("en-US")} credits added`}
          </Heading>
          <Text
            style={{ fontSize: 15, color: "#b5b5b5" }}
          >{`Your new balance is ${props.balance.toLocaleString("en-US")} credits. Top-up credits never expire.`}</Text>
          <Text style={{ fontSize: 13, color: "#8a8a8a" }}>
            Stripe sends your payment receipt separately. Billing history:{" "}
            <Link href={props.accountUrl} style={{ color: BRAND.primary }}>
              {props.accountUrl}
            </Link>
          </Text>
          <Text
            style={{ fontSize: 12, color: "#6b6b6b" }}
          >{`Questions? ${BRAND.supportEmail}`}</Text>
        </Container>
      </Body>
    </Html>
  )
}
