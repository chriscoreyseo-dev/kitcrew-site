"use client"

import { useStudioMode } from "@/components/site/studio-mode"

/** markethive mode has no email sign-in: members arrive signed in from their
    MarketHive dashboard (D-056). This sends them back there, in the top window. */
export function MarketHiveSignIn() {
  const { homeUrl } = useStudioMode()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Hive Studio opens from your MarketHive dashboard. Use the Hive Studio
        badge there and you&apos;ll be signed in here automatically.
      </p>
      {homeUrl ? (
        <a
          href={homeUrl}
          target="_top"
          className="block rounded-xl bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/85"
        >
          Go to MarketHive
        </a>
      ) : null}
    </div>
  )
}
