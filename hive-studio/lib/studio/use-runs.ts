"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  cancelGenerationAction,
  deleteGenerationAction,
  listGenerationsAction,
  submitGenerationAction,
} from "@/generation/actions"
import type { GenerationPlane } from "@/generation/catalog"

import type { RunRecord } from "./history"

export const STATUS_POLL_MS = 3500

/**
 * The studio's generation controller. Same interface as the template's, but
 * runs live in MongoDB: submit/cancel/delete are server actions, history loads
 * from the server, and in-flight runs are refreshed by polling our own
 * GET /api/generations/status (DB only). Never poll through a server action:
 * Next runs them one at a time per client, so polls would queue ahead of the
 * next submit.
 */
export function useRuns(
  enabled = true,
  options: {
    onInsufficientCredits?: (message: string) => void
    onSettled?: () => void
  } = {}
) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const [records, setRecords] = useState<RunRecord[]>([])
  const [loaded, setLoaded] = useState(!enabled)
  const [error, setError] = useState<string | null>(null)
  const recordsRef = useRef(records)
  useEffect(() => {
    recordsRef.current = records
  }, [records])

  const merge = useCallback((updates: RunRecord[]) => {
    if (!updates.length) return
    const byId = new Map(updates.map((u) => [u.id, u]))
    setRecords((current) => current.map((r) => byId.get(r.id) ?? r))
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void listGenerationsAction().then((result) => {
      if (!alive) return
      if (result.ok) setRecords(result.data)
      else setError(result.message)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [enabled])

  const refresh = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      try {
        const res = await fetch(
          `/api/generations/status?ids=${ids.join(",")}`,
          {
            cache: "no-store",
          }
        )
        if (!res.ok) return
        const body = (await res.json()) as { runs?: RunRecord[] }
        merge(body.runs ?? [])
        // A run that ended may have refunded credits: let the balance refresh.
        if (body.runs?.some((r) => r.status !== "running"))
          optionsRef.current.onSettled?.()
      } catch {
        /* offline for a moment: the next tick retries */
      }
    },
    [merge]
  )

  const runningKey = records
    .filter((r) => r.status === "running")
    .map((r) => r.id)
    .join(",")

  useEffect(() => {
    if (!runningKey) return
    const ids = runningKey.split(",")
    const timer = setInterval(() => void refresh(ids), STATUS_POLL_MS)
    return () => clearInterval(timer)
  }, [refresh, runningKey])

  const submit = useCallback(
    async (
      plane: GenerationPlane,
      projectId?: string
    ): Promise<RunRecord | null> => {
      setError(null)
      const result = await submitGenerationAction({
        plane,
        clientRequestId: crypto.randomUUID(),
        ...(projectId ? { projectId } : {}),
      })
      if (!result.ok) {
        if (
          result.code === "INSUFFICIENT_CREDITS" &&
          optionsRef.current.onInsufficientCredits
        )
          optionsRef.current.onInsufficientCredits(result.message)
        else setError(result.message)
        return null
      }
      const record = result.data
      optionsRef.current.onSettled?.()
      setRecords((current) => [
        record,
        ...current.filter((r) => r.id !== record.id),
      ])
      return record
    },
    []
  )

  const cancel = useCallback(
    async (id: string) => {
      const record = recordsRef.current.find((r) => r.id === id)
      if (!record || record.status !== "running") return
      const result = await cancelGenerationAction(id)
      if (!result.ok) setError(result.message)
      else if (result.data === "already_started")
        setError("That generation already started, so it can't be canceled.")
      await refresh([id])
    },
    [refresh]
  )

  const remove = useCallback(async (id: string) => {
    const previous = recordsRef.current
    setRecords((current) => current.filter((r) => r.id !== id))
    const result = await deleteGenerationAction(id)
    if (!result.ok) {
      setRecords(previous)
      setError(result.message)
    }
  }, [])

  const patch = useCallback((id: string, change: Partial<RunRecord>) => {
    setRecords((current) =>
      current.map((r) => (r.id === id ? { ...r, ...change } : r))
    )
  }, [])

  const running = records.filter((r) => r.status === "running")

  return {
    records,
    running,
    loaded,
    error,
    submit,
    cancel,
    remove,
    patch,
    setError,
  }
}
