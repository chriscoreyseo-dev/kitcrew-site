"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, Flag, ImageIcon, Sparkles, Users } from "lucide-react"

import { cn } from "@/lib/utils"

const SECTIONS = [
  { href: "/admin", label: "Users", icon: Users },
  { href: "/admin/generations", label: "Generations", icon: ImageIcon },
  { href: "/admin/models", label: "Models", icon: Boxes },
  { href: "/admin/presets", label: "Effects", icon: Sparkles },
  { href: "/admin/moderation", label: "Moderation", icon: Flag },
] as const

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 border-b border-ink/10">
        {SECTIONS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
