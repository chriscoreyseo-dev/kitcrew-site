"use server"

import { ObjectId } from "mongodb"
import { z } from "zod"

import type { GenerationPlane } from "@/generation/catalog/types"
import { assertCanGenerate } from "@/lib/access"
import { run, RateLimitedError } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-result"
import { SignInRequiredError } from "@/lib/auth-guard"
import {
  cancelGeneration,
  deleteGeneration,
  GenerationInputError,
  generations,
  submitGeneration,
} from "@/lib/generations/lifecycle"
import type { CancelResult } from "@/lib/generations/lifecycle"
import { toRunDTO } from "@/lib/generations/model"
import type { RunDTO } from "@/lib/generations/model"
import { projects } from "@/lib/library"
import { hit } from "@/lib/rate-limit"
import { currentUser } from "@/lib/session"

const ROLE = z.enum(["start", "end", "reference", "video", "audio", "source"])
const MEDIA_ITEM = z.object({
  id: z.string().max(200),
  url: z.url().max(2048),
  role: ROLE,
  kind: z.enum(["image", "video", "audio"]).optional(),
  name: z.string().max(300).optional(),
})
const PLANE = z.object({
  model: z.string().min(1).max(120),
  inputMode: z.string().max(60).optional(),
  prompt: z.object({ text: z.string().max(5000) }),
  media: z.partialRecord(ROLE, z.array(MEDIA_ITEM).max(16)),
  settings: z.record(z.string().max(60), z.unknown()),
})
const SUBMIT = z.object({
  plane: PLANE,
  projectId: z.uuid().optional(),
  clientRequestId: z.uuid(),
  autoPublish: z.boolean().optional(),
})

async function signedIn() {
  const user = await currentUser()
  if (!user) throw new SignInRequiredError()
  return user
}

export async function submitGenerationAction(
  input: unknown
): Promise<ActionResult<RunDTO>> {
  return run(async () => {
    const user = await signedIn()
    assertCanGenerate(user)
    const parsed = SUBMIT.safeParse(input)
    if (!parsed.success) throw new GenerationInputError("Invalid request.")
    const limit = await hit({
      scope: "submit",
      id: user.id,
      max: 12,
      windowSec: 60,
    })
    if (!limit.ok)
      throw new RateLimitedError(
        "You're generating very fast. Wait a few seconds."
      )
    const doc = await submitGeneration({
      userId: user.id,
      plane: parsed.data.plane as GenerationPlane,
      clientRequestId: parsed.data.clientRequestId,
      ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
      ...(parsed.data.autoPublish ? { autoPublish: true } : {}),
    })
    if (doc.projectId)
      await projects().updateOne(
        { _id: doc.projectId, userId: doc.userId },
        { $set: { updatedAt: new Date() } }
      )
    return toRunDTO(doc)
  })
}

export async function cancelGenerationAction(
  id: unknown
): Promise<ActionResult<CancelResult>> {
  return run(async () => {
    const user = await signedIn()
    return cancelGeneration(user.id, String(id))
  })
}

export async function deleteGenerationAction(
  id: unknown
): Promise<ActionResult<null>> {
  return run(async () => {
    const user = await signedIn()
    await deleteGeneration(user.id, String(id))
    return null
  })
}

/** Newest first. The feed virtualizes; deeper paging arrives with /assets (Phase 6). */
export async function listGenerationsAction(): Promise<ActionResult<RunDTO[]>> {
  return run(async () => {
    const user = await signedIn()
    const docs = await generations()
      .find({ userId: new ObjectId(user.id) })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray()
    return docs.map(toRunDTO)
  })
}
