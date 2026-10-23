import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google"

import { CookieConsent } from "@/components/site/cookie-consent"
import { MarketHiveHost } from "@/components/site/markethive-host"
import { SiteHeader } from "@/components/site/site-header"
import { StudioModeProvider } from "@/components/site/studio-mode"
import { studioModeInfo } from "@/lib/mode-info"
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

// Every page reads the deployment mode and session at request time (D-055):
// nothing may be prerendered with build-time values.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Hive Studio",
  description: "Generate AI images, video and audio.",
}

export const viewport: Viewport = { themeColor: "#131416" }

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const info = studioModeInfo()
  // Inside MarketHive the studio wears MarketHive's white theme (S584).
  const markethive = info.mode === "markethive"
  return (
    <html
      lang="en"
      data-theme={markethive ? "markethive-light" : "default-dark"}
      className={cn(
        markethive ? "font-sans antialiased" : "dark font-sans antialiased",
        spaceGrotesk.variable,
        inter.variable,
        plexMono.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground [--header-h:56px]">
        <StudioModeProvider value={info}>
          {markethive && info.homeUrl ? (
            <MarketHiveHost
              homeUrl={info.homeUrl}
              creditsUrl={info.creditsUrl}
            />
          ) : null}
          <SiteHeader />
          {children}
          <CookieConsent />
        </StudioModeProvider>
      </body>
    </html>
  )
}
