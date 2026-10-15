import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AdminNav } from "@/components/admin/admin-nav"
import { Page } from "@/components/site/page"

import { adminOr404 } from "./_lib/guard"

export const metadata: Metadata = {
  title: "Admin · Hive Studio",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  await adminOr404()
  return (
    <Page title="Admin" width="wide">
      <AdminNav />
      <div className="mt-6 min-w-0">{children}</div>
    </Page>
  )
}
