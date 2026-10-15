/* eslint-disable @next/next/no-img-element -- static SVG brand mark */
import Link from "next/link"

import { MODELS } from "@/generation/catalog"
import { BRAND } from "@/lib/brand"
import { balanceOf } from "@/lib/billing/ledger"
import { NAV } from "@/lib/site-config"
import { currentUser } from "@/lib/session"

import { AuthButtons } from "./auth-buttons"
import { BalancePill } from "./balance-pill"
import { MobileNav, NavLinks } from "./nav-links"
import { PromoBar } from "./promo-bar"
import { UserMenu } from "./user-menu"

/** Global chrome: logo · nav · balance · Upgrade · account. A generator tab
    shows only when that surface has at least one verified model. */
export async function SiteHeader() {
  const user = await currentUser()
  let balance: number | null = null
  if (user) {
    try {
      const b = await balanceOf(user.id)
      balance = b.subscription + b.topup
    } catch {
      balance = null
    }
  }
  const items = NAV.filter(
    (item) => !item.surface || MODELS.some((m) => m.surface === item.surface)
  )

  const actions = user ? (
    <>
      {balance !== null ? <BalancePill initial={balance} /> : null}
      <Link
        href="/pricing"
        className="hidden h-8 items-center rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 sm:flex"
      >
        Upgrade
      </Link>
      <UserMenu email={user.email} admin={user.role === "admin"} />
    </>
  ) : (
    <AuthButtons />
  )

  return (
    <div className="sticky top-0 z-40">
      <PromoBar />
      <header className="flex h-[var(--header-h)] items-center gap-4 border-b border-white/[0.06] bg-background/80 px-3 backdrop-blur-xl sm:px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label={`${BRAND.name} home`}
        >
          <img
            src="/brand/mark.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            className="size-7"
          />
          <span className="font-heading text-base font-bold tracking-tight uppercase">
            {BRAND.name}
          </span>
        </Link>
        <NavLinks items={items} />
        <div className="ml-auto flex items-center gap-2">{actions}</div>
        <MobileNav
          items={items}
          footer={
            user ? (
              <Link
                href="/pricing"
                className="block rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground"
              >
                Upgrade
              </Link>
            ) : null
          }
        />
      </header>
    </div>
  )
}
