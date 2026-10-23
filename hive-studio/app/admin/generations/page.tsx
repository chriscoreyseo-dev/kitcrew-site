import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"

import {
  Badge,
  Empty,
  TableScroll,
  formatDate,
  rowClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { SectionTitle } from "@/components/site/page"
import { Button, buttonVariants } from "@/components/ui/button"
import { MODELS } from "@/generation/catalog"
import { listGenerations } from "@/lib/admin"
import type { GenerationStatus } from "@/lib/generations/model"
import { IN_FLIGHT, TERMINAL } from "@/lib/generations/model"
import { cn } from "@/lib/utils"

import { adminOr404 } from "../_lib/guard"

const STATUSES: GenerationStatus[] = [...IN_FLIGHT, ...TERMINAL]

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? ""

function statusTone(status: GenerationStatus) {
  if (status === "completed") return "good" as const
  if (status === "failed" || status === "nsfw") return "bad" as const
  if (status === "canceled") return "neutral" as const
  return "warn" as const
}

export default async function AdminGenerationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await adminOr404()
  const params = await searchParams
  const rawStatus = one(params.status)
  const status = STATUSES.find((s) => s === rawStatus)
  const rawModel = one(params.model)
  const modelId = MODELS.find((m) => m.id === rawModel)?.id
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(one(params.page)) || 1))
  )
  const { rows, hasNext } = await listGenerations({ status, modelId, page })

  const hrefFor = (p: number) =>
    `/admin/generations?${new URLSearchParams({
      ...(status ? { status } : {}),
      ...(modelId ? { model: modelId } : {}),
      page: String(p),
    })}`

  return (
    <section className="min-w-0">
      <SectionTitle>Generations</SectionTitle>
      <form
        action="/admin/generations"
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <label htmlFor="gen-status" className="text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="gen-status"
            name="status"
            defaultValue={status ?? ""}
            className={selectClass}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <label htmlFor="gen-model" className="text-xs text-muted-foreground">
            Model
          </label>
          <select
            id="gen-model"
            name="model"
            defaultValue={modelId ?? ""}
            className={selectClass}
          >
            <option value="">Any model</option>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.surface})
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="lg">
          Filter
        </Button>
        {status || modelId ? (
          <Link
            href="/admin/generations"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Reset
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <Empty>No generations match.</Empty>
      ) : (
        <TableScroll>
          <table className={cn(tableClass, "min-w-[980px]")}>
            <thead>
              <tr>
                <th className={thClass}>Created</th>
                <th className={thClass}>User</th>
                <th className={thClass}>Model</th>
                <th className={thClass}>Status</th>
                <th className={cn(thClass, "text-right")}>Cost</th>
                <th className={thClass}>Prompt / error</th>
                <th className={thClass}>Media</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className={rowClass}>
                  <td
                    className={cn(
                      tdClass,
                      "whitespace-nowrap text-muted-foreground"
                    )}
                  >
                    {formatDate(g.createdAt)}
                  </td>
                  <td className={cn(tdClass, "max-w-[200px] truncate")}>
                    <Link
                      href={`/admin?user=${g.userId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {g.email || g.userId}
                    </Link>
                  </td>
                  <td className={cn(tdClass, "whitespace-nowrap")}>
                    {g.modelLabel}
                    <div className="text-xs text-muted-foreground">
                      {g.surface}
                      {g.isPublic ? " · public" : ""}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Badge tone={statusTone(g.status)}>{g.status}</Badge>
                  </td>
                  <td className={cn(tdClass, "text-right font-mono")}>
                    {g.cost.toLocaleString("en-US")}
                  </td>
                  <td className={cn(tdClass, "max-w-[360px]")}>
                    <p className="line-clamp-2 break-words" title={g.prompt}>
                      {g.prompt || (
                        <span className="text-muted-foreground">No prompt</span>
                      )}
                    </p>
                    {g.error ? (
                      <p className="mt-1 line-clamp-2 text-xs break-words text-red-300">
                        {g.error}
                      </p>
                    ) : null}
                  </td>
                  <td className={tdClass}>
                    {g.outputs.length ? (
                      <ul className="flex flex-wrap gap-1">
                        {g.outputs.map((o, i) => (
                          <li key={o.url}>
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs whitespace-nowrap underline-offset-4 hover:underline"
                            >
                              {o.kind} {i + 1}
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      {page > 1 || hasNext ? (
        <nav
          aria-label="Pages"
          className="mt-4 flex items-center justify-between gap-2"
        >
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              <ChevronLeft aria-hidden />
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">Page {page}</span>
          {hasNext ? (
            <Link
              href={hrefFor(page + 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              Older
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  )
}
