"use client"

import { LogIn, LogOut } from "lucide-react"

import { signOutAction } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Sidebar footer: who is signed in + sign out, or a Sign in button. */
export function AccountRow({
  email,
  collapsed,
  onSignIn,
}: {
  email: string | null
  collapsed: boolean
  onSignIn: () => void
}) {
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
  )
}
