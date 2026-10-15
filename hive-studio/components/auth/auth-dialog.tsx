"use client"

import { LoginForm } from "@/components/auth/login-form"
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xs">
        <DialogHeader>
          <DialogTitle>{`Sign in to ${BRAND.name}`}</DialogTitle>
          <DialogDescription>
            {reason ?? "Enter your email and we'll send you a link."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <LoginForm redirectTo={redirectTo} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
