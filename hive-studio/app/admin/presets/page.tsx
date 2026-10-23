import {
  NewPresetButton,
  PresetRowActions,
} from "@/components/admin/preset-editor"
import type { PresetModelOption } from "@/components/admin/preset-editor"
import {
  Badge,
  Empty,
  TableScroll,
  formatDate,
  rowClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { SectionTitle } from "@/components/site/page"
import { MODELS } from "@/generation/catalog"
import { listAllPresets } from "@/lib/admin"
import { cn } from "@/lib/utils"

import { adminOr404 } from "../_lib/guard"

export default async function AdminPresetsPage() {
  await adminOr404()
  const rows = await listAllPresets()
  const models: PresetModelOption[] = MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    surface: m.surface,
    settings: m.settings,
    roles: m.roles,
  }))
  const labelOf = new Map(MODELS.map((m) => [m.id, m.label]))

  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle className="mb-0">Effects ({rows.length})</SectionTitle>
        <NewPresetButton models={models} />
      </div>
      {rows.length === 0 ? (
        <Empty>No effects yet.</Empty>
      ) : (
        <TableScroll>
          <table className={cn(tableClass, "min-w-[860px]")}>
            <thead>
              <tr>
                <th className={thClass}>Effect</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Model</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Updated</th>
                <th className={thClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={rowClass}>
                  <td className={cn(tdClass, "max-w-[280px]")}>
                    <div className="font-medium">{p.title}</div>
                    <div className="font-mono text-xs break-all text-muted-foreground">
                      {p.slug}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {p.category}
                    <div className="text-xs text-muted-foreground">
                      order {p.order}
                    </div>
                  </td>
                  <td className={cn(tdClass, "whitespace-nowrap")}>
                    {labelOf.get(p.modelId) ?? (
                      <Badge tone="bad">missing: {p.modelId}</Badge>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {p.surface}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {p.active ? (
                      <Badge tone="good">active</Badge>
                    ) : (
                      <Badge>inactive</Badge>
                    )}
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      "whitespace-nowrap text-muted-foreground"
                    )}
                  >
                    {formatDate(p.updatedAt)}
                  </td>
                  <td className={tdClass}>
                    <PresetRowActions preset={p} models={models} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  )
}
