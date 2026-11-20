import type { Metadata } from "next"
import { ObjectId } from "mongodb"
import { notFound, redirect } from "next/navigation"
import { z } from "zod"

import { StudioTemplate } from "@/layouts/studio"
import { projectBelongsTo } from "@/lib/library"
import { currentUser } from "@/lib/session"

export const metadata: Metadata = { title: "Project · Hive Studio" }

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/projects/${encodeURIComponent(id)}`)
  // Someone else's project looks exactly like a missing one.
  if (
    !z.uuid().safeParse(id).success ||
    !(await projectBelongsTo(new ObjectId(user.id), id))
  )
    notFound()
  return (
    <StudioTemplate
      title="Library"
      user={{ email: user.email }}
      initialView={{ kind: "project", projectId: id }}
    />
  )
}
