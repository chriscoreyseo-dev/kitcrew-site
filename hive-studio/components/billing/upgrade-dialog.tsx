"use client"

import { UpgradeOptions } from "@/components/billing/upgrade-options"
import { useStudioMode } from "@/components/site/studio-mode"
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
  const { mode, creditsUrl } = useStudioMode()
  const markethive = mode === "markethive"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {markethive ? "Add Hive credits" : "Get more credits"}
          </DialogTitle>
          <DialogDescription>
            {reason ??
              (markethive
                ? "Hive Studio is paid with your MarketHive credits."
                : "Top up or pick a plan to keep generating.")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {markethive ? (
            creditsUrl ? (
              // The studio runs inside MarketHive's overlay: the wallet opens in
              // the top window, never inside the frame.
              <a
                href={creditsUrl}
                target="_top"
                className="block rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/85"
              >
                Add credits on MarketHive
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add credits from your MarketHive wallet, then come back.
              </p>
            )
          ) : (
            <UpgradeOptions />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
