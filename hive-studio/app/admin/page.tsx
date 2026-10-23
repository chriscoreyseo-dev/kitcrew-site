import { randomUUID } from "node:crypto"

import Link from "next/link"
import { Search } from "lucide-react"

import { ClearFlagButton } from "@/components/admin/clear-flag-button"
import { CreditAdjustForm } from "@/components/admin/credit-adjust-form"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getUserRow, recentLedger, searchUsers } from "@/lib/admin"
import type { AdminUserRow } from "@/lib/admin"
import { cn } from "@/lib/utils"

import { adminOr404 } from "./_lib/guard"
import { isMarketHive } from "@/lib/mode"

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? ""

const n = (value: number) => value.toLocaleString("en-US")

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await adminOr404()
  const params = await searchParams
  const q = one(params.q).trim().slice(0, 254)
  const selectedId = one(params.user)
  const [rows, selected, ledger] = await Promise.all([
    searchUsers(q),
    selectedId ? getUserRow(selectedId) : Promise.resolve(null),
    selectedId ? recentLedger(selectedId, 20) : Promise.resolve([]),
  ])
  const linkFor = (id: string) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), user: id })}`

  return (
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0">
        <SectionTitle>Users</SectionTitle>
        <form
          action="/admin"
          method="get"
          role="search"
          className="mb-4 flex gap-2"
        >
          <label htmlFor="admin-user-q" className="sr-only">
            Email starts with
          </label>
          <Input
            id="admin-user-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Email starts with…"
            autoComplete="off"
            className="min-w-0 flex-1"
            start={<Search className="size-4" aria-hidden />}
          />
          <Button type="submit" variant="outline" size="lg">
            Search
          </Button>
        </form>
        {rows.length === 0 ? (
          <Empty>
            {q ? `No users with an email starting "${q}".` : "No users yet."}
          </Empty>
        ) : (
          <TableScroll>
            <table className={cn(tableClass, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Plan</th>
                  <th className={cn(thClass, "text-right")}>Plan credits</th>
                  <th className={cn(thClass, "text-right")}>Top-up</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Flag</th>
                  <th className={thClass}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      rowClass,
                      u.id === selected?.id && "bg-ink/5"
                    )}
                  >
                    <td className={tdClass}>
                      <Link
                        href={linkFor(u.id)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {u.email || "(no email)"}
                      </Link>
                    </td>
                    <td className={tdClass}>{u.plan}</td>
                    <td className={cn(tdClass, "text-right font-mono")}>
                      {n(u.credits.subscription)}
                    </td>
                    <td className={cn(tdClass, "text-right font-mono")}>
                      {n(u.credits.topup)}
                    </td>
                    <td className={tdClass}>
                      {u.role === "admin" ? (
                        <Badge tone="good">admin</Badge>
                      ) : (
                        "user"
                      )}
                    </td>
                    <td className={tdClass}>
                      {u.billingFlag ? (
                        <Badge tone="warn">{u.billingFlag}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        tdClass,
                        "whitespace-nowrap text-muted-foreground"
                      )}
                    >
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        {rows.length >= 50 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first 50. Type more of the email to narrow it down.
          </p>
        ) : null}
      </section>

      <aside className="min-w-0">
        {selected ? (
          <UserDetail user={selected} ledger={ledger} />
        ) : (
          <>
            <SectionTitle>Account</SectionTitle>
            <Empty>
              Select a user to adjust credits or review their ledger.
            </Empty>
          </>
        )}
      </aside>
    </div>
  )
}

function UserDetail({
  user,
  ledger,
}: {
  user: AdminUserRow
  ledger: Awaited<ReturnType<typeof recentLedger>>
}) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Account</SectionTitle>
        <div className="flex flex-col gap-3 rounded-xl border border-ink/10 p-4">
          <p className="font-medium break-all">{user.email}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ["Plan", user.plan],
                ["Plan credits", n(user.credits.subscription)],
                ["Top-up", n(user.credits.topup)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate font-mono">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Billing flag:</span>
            {user.billingFlag ? (
              <>
                <Badge tone="warn">{user.billingFlag}</Badge>
                <ClearFlagButton userId={user.id} />
              </>
            ) : (
              <span>none</span>
            )}
          </div>
        </div>
      </section>

      {isMarketHive() ? null : (
        <section>
          <SectionTitle>Adjust credits</SectionTitle>
          <CreditAdjustForm
            key={user.id}
            userId={user.id}
            initialToken={randomUUID()}
          />
        </section>
      )}

      <section className="min-w-0">
        <SectionTitle>Last 20 ledger entries</SectionTitle>
        {ledger.length === 0 ? (
          <Empty>No credit activity.</Empty>
        ) : (
          <TableScroll>
            <table className={cn(tableClass, "min-w-[440px]")}>
              <thead>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>Reason</th>
                  <th className={cn(thClass, "text-right")}>Change</th>
                  <th className={cn(thClass, "text-right")}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className={rowClass}>
                    <td
                      className={cn(
                        tdClass,
                        "whitespace-nowrap text-muted-foreground"
                      )}
                    >
                      {formatDate(e.createdAt)}
                    </td>
                    <td className={tdClass}>
                      <div>{e.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.bucket}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </td>
                    <td
                      className={cn(
                        tdClass,
                        "text-right font-mono",
                        e.delta < 0 ? "text-red-300" : "text-emerald-300"
                      )}
                    >
                      {e.delta > 0 ? "+" : ""}
                      {n(e.delta)}
                    </td>
                    <td className={cn(tdClass, "text-right font-mono")}>
                      {n(e.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </div>
  )
}
