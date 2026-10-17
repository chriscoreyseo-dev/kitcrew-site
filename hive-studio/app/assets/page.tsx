import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"
import { StudioTemplate } from "@/layouts/studio"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Assets · Hive Studio" }

/** The user's library: all generations, projects sidebar, uploads in the asset picker. */
export default async function AssetsPage() {
  if (MODELS.length === 0) return <NoModels />
  const user = await currentUser()
  if (!user) redirect("/login?next=/assets")
  return (
    <StudioTemplate
      title="Library"
      user={{ email: user.email }}
      initialView={{ kind: "all" }}
    />
  )
}
