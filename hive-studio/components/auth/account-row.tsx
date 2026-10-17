"use client"

import { LogIn, LogOut, Sparkles } from "lucide-react"

import { signOutAction } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useFormatCredits } from "@/components/site/studio-mode"
import { cn } from "@/lib/utils"

/** Sidebar footer: who is signed in + sign out, or a Sign in button. */
export function AccountRow({
  email,
  collapsed,
  onSignIn,
  balance = null,
  onBuyCredits,
}: {
  email: string | null
  collapsed: boolean
  onSignIn: () => void
  balance?: number | null
  onBuyCredits?: () => void
}) {
  const fmt = useFormatCredits()
  if (!email)
    return (
      <Button
        variant="outline"
        className={cn("w-full", collapsed && "px-0")}
        onClick={onSignIn}
        aria-label="Sign in"
      >
        <LogIn aria-hidden />
        {collapsed ? null : "Sign in"}
      </Button>
    )

  return (
    <div className="flex flex-col gap-1">
      {balance !== null && onBuyCredits ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start font-mono",
            collapsed && "justify-center px-0"
          )}
          onClick={onBuyCredits}
          aria-label={`${fmt(balance)} credits. Get more credits`}
          title="Get more credits"
        >
          <Sparkles aria-hidden className="text-primary" />
          {collapsed ? null : fmt(balance)}
        </Button>
      ) : null}
      <form
        action={signOutAction}
        className={cn(
          "flex items-center gap-2 rounded-lg px-1.5 py-1",
          collapsed && "justify-center px-0"
        )}
      >
        {collapsed ? null : (
          <span
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            title={email}
          >
            {email}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="Sign out"
              />
            }
          >
            <LogOut aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </form>
    </div>
  )
}
