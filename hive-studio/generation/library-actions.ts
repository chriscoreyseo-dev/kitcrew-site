"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import { run } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import { GenerationInputError, generations } from "@/lib/generations/lifecycle"
import {
  projects,
  toProjectDTO,
  toUploadDTO,
  UPLOAD_MAX_BYTES,
  uploads,
} from "@/lib/library"
import type { ProjectDTO, UploadDTO } from "@/lib/library"
import { currentUser } from "@/lib/session"

async function userObjectId() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return new ObjectId(user.id)
}

const NAME = z.string().trim().min(1).max(80)
const PROJECT_ID = z.uuid()

export async function listLibraryAction(): Promise<
  ActionResult<{ projects: ProjectDTO[]; uploads: UploadDTO[] }>
> {
  return run(async () => {
    const userId = await userObjectId()
    const [p, u] = await Promise.all([
      projects().find({ userId }).sort({ updatedAt: -1 }).limit(200).toArray(),
      uploads()
        .find({ userId, status: "ready" })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray(),
    ])
    return { projects: p.map(toProjectDTO), uploads: u.map(toUploadDTO) }
  })
}

export async function createProjectAction(
  id: unknown,
  name: unknown
): Promise<ActionResult<ProjectDTO>> {
  return run(async () => {
    const userId = await userObjectId()
    const parsedId = PROJECT_ID.safeParse(id)
    const parsedName = NAME.safeParse(name)
    if (!parsedId.success || !parsedName.success)
      throw new GenerationInputError("Invalid project name.")
    const now = new Date()
    const doc = {
      _id: parsedId.data,
      userId,
      name: parsedName.data,
      createdAt: now,
      updatedAt: now,
    }
    await projects().insertOne(doc)
    return toProjectDTO(doc)
  })
}

export async function renameProjectAction(
  id: unknown,
  name: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    const userId = await userObjectId()
    const parsedId = PROJECT_ID.safeParse(id)
    const parsedName = NAME.safeParse(name)
    if (!parsedId.success || !parsedName.success)
      throw new GenerationInputError("Invalid project name.")
    const result = await projects().updateOne(
      { _id: parsedId.data, userId },
      { $set: { name: parsedName.data, updatedAt: new Date() } }
    )
    if (!result.matchedCount)
      throw new GenerationInputError("Project not found.")
    return null
  })
}

/** Deleting a project keeps its generations; they return to All Generations. */
export async function deleteProjectAction(
  id: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    const userId = await userObjectId()
    const parsedId = PROJECT_ID.safeParse(id)
    if (!parsedId.success) throw new GenerationInputError("Project not found.")
    const result = await projects().deleteOne({ _id: parsedId.data, userId })
    if (result.deletedCount)
      await generations().updateMany(
        { userId, projectId: parsedId.data },
        { $unset: { projectId: "" } }
      )
    return null
  })
}

/** Called after the browser's PUT to the signed URL succeeds. */
export async function confirmUploadAction(
  id: unknown,
  bytes: unknown,
  name: unknown
): Promise<ActionResult<UploadDTO>> {
  return run(async () => {
    const userId = await userObjectId()
    if (typeof id !== "string" || !ObjectId.isValid(id))
      throw new GenerationInputError("Upload not found.")
    const size =
      typeof bytes === "number" && Number.isFinite(bytes)
        ? Math.max(0, Math.floor(bytes))
        : 0
    const doc = await uploads().findOne({ _id: new ObjectId(id), userId })
    if (!doc) throw new GenerationInputError("Upload not found.")
    if (size > UPLOAD_MAX_BYTES[doc.kind]) {
      await uploads().deleteOne({ _id: doc._id })
      throw new GenerationInputError("That file is too large.")
    }
    const updated = await uploads().findOneAndUpdate(
      { _id: doc._id, userId },
      {
        $set: {
          status: "ready",
          bytes: size,
          ...(typeof name === "string" && name
            ? { name: name.slice(0, 120) }
            : {}),
        },
      },
      { returnDocument: "after" }
    )
    if (!updated) throw new GenerationInputError("Upload not found.")
    return toUploadDTO(updated)
  })
}
