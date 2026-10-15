"use client"

import { UpgradeOptions } from "@/components/billing/upgrade-options"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function UpgradeDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Get more credits</DialogTitle>
          <DialogDescription>
            {reason ?? "Top up or pick a plan to keep generating."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <UpgradeOptions />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
