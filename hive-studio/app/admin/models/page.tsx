import { ModelControls } from "@/components/admin/model-controls"
import {
  Badge,
  TableScroll,
  rowClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { SectionTitle } from "@/components/site/page"
import { listModelRows } from "@/lib/admin"
import type { PriceRule } from "@/lib/billing/price"
import { cn } from "@/lib/utils"

import { adminOr404 } from "../_lib/guard"

function ruleSummary(rule: PriceRule | null): string {
  if (!rule) return "Unpriced"
  const { base } = rule
  const usd = `$${base.usd}`
  const head =
    base.kind === "per_run"
      ? `${usd} / run`
      : base.kind === "per_image"
        ? `${usd} / image${base.countSetting ? ` × ${base.countSetting}` : ""}`
        : `${usd} / s × ${base.durationSetting ?? "duration"} (default ${base.defaultSeconds}s)`
  const mult = Object.keys(rule.multipliers ?? {})
  return mult.length ? `${head} · × ${mult.join(", ")}` : head
}

export default async function AdminModelsPage() {
  await adminOr404()
  const rows = await listModelRows()
  return (
    <section className="min-w-0">
      <SectionTitle>Models ({rows.length})</SectionTitle>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Effective price = the static pricing table, replaced by an override when
        one is set. Quotes use each model&apos;s default settings. Disabled
        models are hidden from the generators. Edits apply within 30 seconds on
        every server.
      </p>
      <TableScroll>
        <table className={cn(tableClass, "min-w-[900px]")}>
          <thead>
            <tr>
              <th className={thClass}>Model</th>
              <th className={thClass}>Effective pricing</th>
              <th className={cn(thClass, "text-right")}>Default quote</th>
              <th className={thClass}>Enabled</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={rowClass}>
                <td className={tdClass}>
                  <div className="font-medium whitespace-nowrap">{m.label}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {m.id} · {m.surface}
                  </div>
                </td>
                <td className={cn(tdClass, "max-w-[360px]")}>
                  <div className="font-mono text-xs break-words">
                    {ruleSummary(m.rule)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.hasRuleOverride ? (
                      <Badge tone="warn">override</Badge>
                    ) : (
                      <Badge>table</Badge>
                    )}
                    {m.hfUsdSource ? <Badge>{m.hfUsdSource}</Badge> : null}
                  </div>
                </td>
                <td
                  className={cn(
                    tdClass,
                    "text-right font-mono whitespace-nowrap"
                  )}
                >
                  {m.quote ? (
                    <>
                      ✦ {m.quote.credits.toLocaleString("en-US")}
                      <div className="text-xs text-muted-foreground">
                        ${m.quote.usd.toFixed(4)}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <ModelControls
                  modelId={m.id}
                  label={m.label}
                  enabled={m.enabled}
                  hasRuleOverride={m.hasRuleOverride}
                  rule={m.rule}
                  settings={m.settings}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </section>
  )
}
