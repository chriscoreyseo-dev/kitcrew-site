"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"

import type { NavItem } from "@/lib/site-config"
import { cn } from "@/lib/utils"

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`)
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            "aria-[current=page]:bg-white/10 aria-[current=page]:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/** Mobile: a full-width sheet under the header. */
export function MobileNav({
  items,
  footer,
}: {
  items: NavItem[]
  footer?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  // Close the sheet on navigation.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-[var(--header-h)] bottom-0 z-50 overflow-y-auto border-t border-white/10 bg-background/95 px-4 py-4 backdrop-blur-xl"
        >
          <nav aria-label="Main" className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActive(pathname, item.href) ? "page" : undefined
                }
                className="rounded-xl px-3 py-3 font-heading text-2xl font-bold uppercase aria-[current=page]:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {footer ? (
            <div className="mt-6 border-t border-white/10 pt-4">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
