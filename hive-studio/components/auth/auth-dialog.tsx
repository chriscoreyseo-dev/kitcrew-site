"use client"

import { LoginForm } from "@/components/auth/login-form"
import { MarketHiveSignIn } from "@/components/auth/markethive-signin"
import { useStudioMode } from "@/components/site/studio-mode"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BRAND } from "@/lib/brand"

export function AuthDialog({
  open,
  onOpenChange,
  reason,
  redirectTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
  redirectTo?: string
}) {
  const { mode } = useStudioMode()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xs">
        <DialogHeader>
          <DialogTitle>{`Sign in to ${BRAND.name}`}</DialogTitle>
          <DialogDescription>
            {reason ??
              (mode === "markethive"
                ? "Your MarketHive session has ended."
                : "Enter your email and we'll send you a link.")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {mode === "markethive" ? (
            <MarketHiveSignIn />
          ) : (
            <LoginForm redirectTo={redirectTo} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
