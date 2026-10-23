/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react"

import { ReportActions } from "@/components/admin/report-actions"
import { Badge, Empty, formatDate } from "@/components/admin/ui"
import { SectionTitle } from "@/components/site/page"
import { listOpenReportGroups } from "@/lib/admin"
import type { AdminReportGroup } from "@/lib/admin"

import { adminOr404 } from "../_lib/guard"

export default async function AdminModerationPage() {
  await adminOr404()
  const groups = await listOpenReportGroups()
  return (
    <section className="min-w-0">
      <SectionTitle>Open reports ({groups.length})</SectionTitle>
      {groups.length === 0 ? (
        <Empty>No open reports.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => (
            <li key={g.generationId}>
              <ReportCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Preview({ output }: { output: { kind: string; url: string } }) {
  if (output.kind === "video")
    return (
      <video
        src={output.url}
        muted
        loop
        playsInline
        controls
        preload="metadata"
        className="size-full object-cover"
      />
    )
  if (output.kind === "audio")
    return (
      <div className="flex size-full items-center p-2">
        <audio src={output.url} controls preload="none" className="w-full" />
      </div>
    )
  return (
    <img
      src={output.url}
      alt="Reported output"
      loading="lazy"
      className="size-full object-cover"
    />
  )
}

function ReportCard({ group }: { group: AdminReportGroup }) {
  const gen = group.generation
  const first = gen?.outputs[0]
  return (
    <article className="flex h-full min-w-0 gap-3 rounded-xl border border-ink/10 p-3">
      <div className="aspect-square w-28 shrink-0 overflow-hidden rounded-lg bg-ink/5 sm:w-36">
        {first ? (
          <Preview output={first} />
        ) : (
          <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
            No media
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone="bad">
            {group.count} report{group.count === 1 ? "" : "s"}
          </Badge>
          {Object.entries(group.reasons).map(([reason, count]) => (
            <Badge key={reason}>
              {reason}
              {count > 1 ? ` ×${count}` : ""}
            </Badge>
          ))}
          {gen && !gen.isPublic ? <Badge>not public</Badge> : null}
        </div>
        {gen ? (
          <>
            <p className="line-clamp-3 text-sm break-words">
              {gen.prompt || (
                <span className="text-muted-foreground">No prompt</span>
              )}
            </p>
            <p className="text-xs break-all text-muted-foreground">
              {gen.modelLabel} · {gen.ownerEmail ?? "unknown owner"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The generation no longer exists.
          </p>
        )}
        {group.notes.length ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {group.notes.map((note, i) => (
              <li key={i} className="line-clamp-2 break-words">
                “{note}”
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Latest {formatDate(group.latestAt)}
          {gen?.outputs.length ? (
            <>
              {" · "}
              <a
                href={first?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                Open media
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          ) : null}
        </p>
        <div className="mt-auto">
          <ReportActions generationId={group.generationId} />
        </div>
      </div>
    </article>
  )
}
