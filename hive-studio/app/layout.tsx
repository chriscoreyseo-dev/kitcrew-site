import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google"

import { CookieConsent } from "@/components/site/cookie-consent"
import { SiteHeader } from "@/components/site/site-header"
import { cn } from "@/lib/utils"

import "./globals.css"

// The three Quanta families; globals.css maps them onto --hf-type-family-*-base.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Hive Studio",
  description: "Generate AI images, video and audio.",
}

export const viewport: Viewport = { themeColor: "#131416" }

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="default-dark"
      className={cn(
        "dark font-sans antialiased",
        spaceGrotesk.variable,
        inter.variable,
        plexMono.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground [--header-h:56px]">
        <SiteHeader />
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
