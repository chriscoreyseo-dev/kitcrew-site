/** Site chrome configuration (non-secret, client-safe). */

export type NavItem = {
  href: string
  label: string
  surface?: "image" | "video" | "audio"
}

export const NAV: NavItem[] = [
  { href: "/", label: "Explore" },
  { href: "/image", label: "Image", surface: "image" },
  { href: "/video", label: "Video", surface: "video" },
  { href: "/audio", label: "Audio", surface: "audio" },
  { href: "/effects", label: "Effects" },
  { href: "/community", label: "Community" },
  { href: "/pricing", label: "Pricing" },
]

/** Optional dismissible bar above the nav. Bump `id` to show a new message. */
export const PROMO: {
  enabled: boolean
  id: string
  text: string
  href?: string
} = {
  enabled: false,
  id: "launch-1",
  text: "Hive Studio is in early access.",
  href: "/pricing",
}

export const HEADER_HEIGHT_PX = 56
