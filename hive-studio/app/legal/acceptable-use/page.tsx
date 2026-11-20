import type { Metadata } from "next"

import { Page } from "@/components/site/page"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Acceptable Use Policy · Hive Studio",
}

/** Placeholder: the operator replaces this with reviewed legal copy before launch. */
export default function LegalPage() {
  return (
    <Page title="Acceptable Use Policy" width="narrow">
      <div className="rounded-2xl border border-dashed border-ink/15 p-6 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">
          This page is a placeholder.
        </p>
        <p className="mt-2">
          The final {`${BRAND.name}`} Acceptable Use Policy will be published
          here before launch. Questions in the meantime:{" "}
          <a
            className="text-foreground underline"
            href={`mailto:${BRAND.supportEmail}`}
          >
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </div>
    </Page>
  )
}
