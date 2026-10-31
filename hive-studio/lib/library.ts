import "server-only"

import { ObjectId } from "mongodb"

import type { MediaKind } from "@/generation/catalog/types"
import { db } from "@/lib/db/mongo"

/** Projects and uploads, always scoped by userId. */

export type ProjectDoc = {
  /** Client-generated UUID, so the studio can switch to a new project instantly. */
  _id: string
  userId: ObjectId
  name: string
  createdAt: Date
  updatedAt: Date
}

export type UploadDoc = {
  _id: ObjectId
  userId: ObjectId
  /** Recorded server-side when the signed URL is issued; never sent by the browser. */
  publicUrl: string
  contentType: string
  kind: MediaKind
  name?: string
  bytes?: number
  status: "pending" | "ready"
  createdAt: Date
}

export type ProjectDTO = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}
export type UploadDTO = {
  id: string
  src: string
  kind: MediaKind
  name?: string
  createdAt: number
}

export const projects = () => db().collection<ProjectDoc>("projects")
export const uploads = () => db().collection<UploadDoc>("uploads")

export const toProjectDTO = (p: ProjectDoc): ProjectDTO => ({
  id: p._id,
  name: p.name,
  createdAt: p.createdAt.getTime(),
  updatedAt: p.updatedAt.getTime(),
})

export const toUploadDTO = (u: UploadDoc): UploadDTO => ({
  id: u._id.toHexString(),
  src: u.publicUrl,
  kind: u.kind,
  ...(u.name ? { name: u.name } : {}),
  createdAt: u.createdAt.getTime(),
})

export async function projectBelongsTo(
  userId: ObjectId,
  projectId: string
): Promise<boolean> {
  return (
    (await projects().countDocuments(
      { _id: projectId, userId },
      { limit: 1 }
    )) > 0
  )
}

/** Per-kind size limits we enforce on top of the platform's. */
export const UPLOAD_MAX_BYTES: Record<MediaKind, number> = {
  image: 20 * 1024 ** 2,
  video: 200 * 1024 ** 2,
  audio: 50 * 1024 ** 2,
}
