import "server-only"

import { env } from "@/lib/env"

import { copyToLocal, deleteFromLocal, storeFileLocal } from "./local"
import { copyToR2, deleteFromR2, isR2Configured, storeFileR2 } from "./r2"

/** The output store this deployment uses (STORAGE_DRIVER, D-059). */

export type StoredOutput = {
  key: string
  url: string
  contentType: string
  bytes: number
}

export type StoreInput = {
  sourceUrl: string
  userId: string
  generationId: string
  index: number
  kind: "image" | "video" | "audio"
}

const isLocal = () => env().STORAGE_DRIVER === "local"

export function isStorageConfigured(): boolean {
  return isLocal() || isR2Configured()
}

export function storeOutput(input: StoreInput): Promise<StoredOutput> {
  return isLocal() ? copyToLocal(input) : copyToR2(input)
}

/** A file this server made (S611: a result with its soundtrack laid back on). */
export function storeOutputFile(
  input: Omit<StoreInput, "sourceUrl"> & { file: string; contentType: string }
): Promise<StoredOutput> {
  return isLocal() ? storeFileLocal(input) : storeFileR2(input)
}

export function deleteOutputs(keys: string[]): Promise<void> {
  if (!keys.length) return Promise.resolve()
  return isLocal() ? deleteFromLocal(keys) : deleteFromR2(keys)
}
