"use client"

import Link from "next/link"

import { signOutAction } from "@/app/login/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu({ email, admin }: { email: string; admin: boolean }) {
  const initial = email.slice(0, 1).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold hover:bg-white/20"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuItem render={<Link href="/assets" />}>
          Assets
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>
          Account
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/billing" />}>
          Billing
        </DropdownMenuItem>
        {admin ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOutAction()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
