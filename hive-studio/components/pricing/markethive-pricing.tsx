import { Page, SectionTitle } from "@/components/site/page"
import { MARKETHIVE_CONCURRENCY } from "@/lib/billing/wallet"
import { studioModeInfo } from "@/lib/mode-info"

const SURFACES = [
  ["image", "Image"],
  ["video", "Video"],
  ["audio", "Audio"],
] as const

/** markethive mode pricing (S577-DRL-02): each run is priced from what it
    really costs to make, so longer or higher-resolution runs cost more. No
    plans, no checkout here (D-057). */
export async function MarketHivePricing() {
  const info = studioModeInfo()
  return (
    <Page
      title="Pricing"
      subtitle="Hive Studio is paid with your MarketHive credits. Every generation shows its price on the Generate button before you run it."
      width="narrow"
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {SURFACES.map(([id, label]) => {
          return (
            <div key={id} className="rounded-2xl border border-white/10 p-4">
              <p className="text-xs text-muted-foreground uppercase">
                {label} generation
              </p>
              <p className="mt-1 text-sm font-semibold">
                Priced per run by model, length and size
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Up to {MARKETHIVE_CONCURRENCY[id]} at once
              </p>
            </div>
          )
        })}
      </section>
      <section className="mt-10">
        <SectionTitle>How Hive credits work</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Credits are taken from your MarketHive balance when a generation
          starts and returned automatically if it fails, is blocked by the
          content filter, or you cancel it while it&apos;s queued. Every charge
          and refund shows in your MarketHive wallet.
        </p>
        {info.creditsUrl ? (
          <a
            href={info.creditsUrl}
            target="_top"
            className="mt-4 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
          >
            Add credits on MarketHive
          </a>
        ) : null}
      </section>
    </Page>
  )
}
