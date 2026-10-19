"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { balanceAction, pricingAction } from "@/generation/billing-actions"
import { getModel, parseSettings } from "@/generation/catalog"
import type {
  GenerationPlane,
  MediaItem,
  MediaRole,
  ModelEntry,
  Surface,
} from "@/generation/catalog"
import {
  changeImageRole,
  groupMedia,
  inferInputMode,
  inputRoles,
  mergeMedia,
  mergeReferences,
} from "@/generation/catalog/media-inputs"
import { publishGenerationAction } from "@/generation/community-actions"
import { listLibraryAction } from "@/generation/library-actions"
import { useAutoPublish } from "@/generation/stores/auto-publish"
import { useSettings } from "@/generation/stores/settings"
import { toPlatform } from "@/generation/to-platform"
import { priceFor } from "@/lib/billing/price"
import type { PriceRule } from "@/lib/billing/price"
import { announceBalance } from "@/lib/client-events"
import { saveDockDraft, takeDockDraft } from "@/lib/studio/dock-draft"
import {
  runToGalleryItems,
  runToLibraryItems,
} from "@/lib/studio/gallery-items"
import { useProjects } from "@/lib/studio/projects"
import { uploadAsset, useUploads } from "@/lib/studio/uploads"
import type { AssetSelection } from "@/lib/studio/uploads"
import { useRuns } from "@/lib/studio/use-runs"

export type ComposerInit = {
  modelId?: string
  prompt?: string
  settings?: Record<string, unknown>
  /** e.g. Animate: an image of the user's becomes the start frame. */
  media?: MediaItem[]
}

export type PricingRules = Record<
  string,
  { rule: PriceRule | null; enabled: boolean }
>

/**
 * Everything a generator screen needs, independent of layout: model, prompt,
 * media, settings, the validated plane, cost, runs, sign-in gating (with the
 * dock draft), the upgrade modal and the live balance. The server re-validates
 * and re-prices every submit; this is only for showing the user the truth early.
 */
export function useComposer({
  surface,
  models,
  user,
  init,
}: {
  surface: Surface
  models: ModelEntry[]
  user: { email: string } | null
  init?: ComposerInit
}) {
  const initialModel = models.find((m) => m.id === init?.modelId) ?? models[0]!
  const [modelId, setModelId] = useState(initialModel.id)
  const [prompt, setPrompt] = useState(init?.prompt ?? "")
  const [media, setMedia] = useState<MediaItem[]>(init?.media ?? [])
  const [localError, setLocalError] = useState<string | null>(null)
  const [authReason, setAuthReason] = useState<string | null>(null)
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [pricing, setPricing] = useState<PricingRules>({})

  const settingsByModel = useSettings((s) => s.byModel)
  const setSetting = useSettings((s) => s.set)
  const uploads = useUploads((s) => s.items)
  const autoPublish = useAutoPublish((s) => s.on)
  const setAutoPublish = useAutoPublish((s) => s.set)

  useEffect(() => {
    void useAutoPublish.persist.rehydrate()
  }, [])

  // Preset / recreate settings apply once, on first render of that model.
  useEffect(() => {
    if (init?.settings && init.modelId) setSetting(init.modelId, init.settings)
  }, [init?.modelId, init?.settings, setSetting])

  const refreshBalance = useCallback(() => {
    if (!user) return
    void balanceAction().then((r) => {
      if (r.ok) announceBalance(r.data.subscription + r.data.topup)
    })
  }, [user])

  const runs = useRuns(Boolean(user), {
    onInsufficientCredits: (message) => setUpgradeReason(message),
    onSettled: refreshBalance,
  })

  useEffect(() => {
    void pricingAction().then((r) => {
      if (r.ok) setPricing(r.data)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    void listLibraryAction().then((result) => {
      if (!alive || !result.ok) return
      useProjects.getState().hydrate(result.data.projects)
      useUploads
        .getState()
        .hydrate(
          result.data.uploads.map((u) => ({ ...u, source: "upload" as const }))
        )
    })
    return () => {
      alive = false
    }
  }, [user])

  // Restore the dock after sign-in (never auto-submit).
  useEffect(() => {
    if (!user) return
    const draft = takeDockDraft()
    if (!draft) return
    const target = models.find((m) => m.id === draft.modelId)
    if (!target) return
    // localStorage is unavailable during SSR; this runs once per sign-in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModelId(target.id)
    setPrompt(draft.prompt)
    setMedia(draft.media)
  }, [user, models])

  const model = useMemo(() => {
    try {
      const found = getModel(modelId)
      return found.surface === surface ? found : models[0]!
    } catch {
      return models[0]!
    }
  }, [modelId, models, surface])

  const settings = useMemo(
    () => settingsByModel[model.id] ?? {},
    [settingsByModel, model.id]
  )
  const inputMode = inferInputMode(model, media)
  const roles = inputRoles(model, inputMode)
  const quote = priceFor(
    pricing[model.id]?.rule,
    parseSettings(model, settings),
    { markup: 1, creditUsdValue: 1 }
  )
  const priced = (m: ModelEntry) =>
    priceFor(
      pricing[m.id]?.rule,
      parseSettings(m, settingsByModel[m.id] ?? {}),
      { markup: 1, creditUsdValue: 1 }
    )
  const enabledModels = models.filter((m) => pricing[m.id]?.enabled !== false)

  const prepared = useMemo(() => {
    try {
      const plane: GenerationPlane = {
        model: model.id,
        inputMode,
        prompt: { text: prompt.trim() },
        media: groupMedia(media),
        settings: parseSettings(model, settings),
      }
      toPlatform(plane)
      return { plane, error: null as string | null }
    } catch (caught) {
      return {
        plane: null,
        error: caught instanceof Error ? caught.message : String(caught),
      }
    }
  }, [inputMode, media, model, prompt, settings])

  const surfaceRecords = useMemo(
    () => runs.records.filter((r) => r.surface === surface),
    [runs.records, surface]
  )
  const galleryItems = useMemo(
    () => surfaceRecords.flatMap(runToGalleryItems),
    [surfaceRecords]
  )
  const libraryItems = useMemo(
    () => [...uploads, ...runs.records.flatMap(runToLibraryItems)],
    [runs.records, uploads]
  )
  const running = surfaceRecords.filter((r) => r.status === "running")
  const cancellable = running.filter((r) => r.phase === "queued")

  const askToSignIn = useCallback(
    (reason: string) => {
      saveDockDraft({ prompt, media, modelId: model.id })
      setAuthReason(reason)
    },
    [media, model.id, prompt]
  )

  const generate = useCallback(async () => {
    if (!prepared.plane) return
    if (!user) {
      askToSignIn(
        "Sign in to generate. Your prompt will be here when you're back."
      )
      return
    }
    setLocalError(null)
    const record = await runs.submit(prepared.plane, undefined, autoPublish)
    if (record) refreshBalance()
  }, [askToSignIn, autoPublish, prepared.plane, refreshBalance, runs, user])

  const cancelQueued = useCallback(() => {
    if (canceling || !cancellable.length) return
    setCanceling(true)
    void Promise.all(cancellable.map((r) => runs.cancel(r.id))).finally(() =>
      setCanceling(false)
    )
  }, [canceling, cancellable, runs])

  const upload = useCallback(
    async (file: File) => {
      if (!user) {
        askToSignIn("Sign in to upload references.")
        throw new Error("Sign in to upload references.")
      }
      return uploadAsset(file)
    },
    [askToSignIn, user]
  )

  const addMedia = useCallback(
    (role: MediaRole | "auto", selection: AssetSelection[]) => {
      const selected = selection.map((item) => ({
        id: item.id,
        url: item.src,
        kind: item.kind,
        name: item.name,
      }))
      setLocalError(null)
      setMedia((current) =>
        role === "auto"
          ? mergeReferences(current, selected, roles)
          : mergeMedia(
              current,
              role,
              selected.map((item) => ({ ...item, role })),
              roles[role] ?? 0
            )
      )
    },
    [roles]
  )

  const removeMedia = useCallback(
    (id: string) => setMedia((current) => current.filter((m) => m.id !== id)),
    []
  )

  const changeRole = useCallback(
    (id: string, role: "start" | "end" | "reference") => {
      try {
        setMedia((current) => changeImageRole(model, current, id, role))
        setLocalError(null)
      } catch (caught) {
        setLocalError(
          caught instanceof Error
            ? caught.message
            : "Could not change the image role."
        )
      }
    },
    [model]
  )

  const selectModel = useCallback((id: string) => {
    setLocalError(null)
    setModelId(id)
  }, [])

  const publish = useCallback(
    async (runId: string, value: boolean) => {
      const result = await publishGenerationAction(runId, value)
      if (result.ok) runs.patch(runId, { isPublic: result.data.isPublic })
      else setLocalError(result.message)
    },
    [runs]
  )

  const reuse = useCallback(
    (item: {
      prompt: string
      modelId?: string
      settings: Record<string, unknown>
    }) => {
      setPrompt(item.prompt)
      const target = models.find((m) => m.id === item.modelId)
      if (target) {
        setModelId(target.id)
        setSetting(target.id, item.settings)
      }
    },
    [models, setSetting]
  )

  const canGenerate =
    prepared.plane !== null && (prompt.trim().length > 0 || media.length > 0)

  return {
    model,
    models: enabledModels,
    selectModel,
    priced,
    settings,
    setSetting: (key: string, value: unknown) =>
      setSetting(model.id, { [key]: value }),
    prompt,
    setPrompt,
    media,
    addMedia,
    removeMedia,
    changeRole,
    roles,
    inputMode,
    quote,
    prepared,
    canGenerate,
    generate,
    running,
    cancellable,
    cancelQueued,
    canceling,
    upload,
    libraryItems,
    galleryItems,
    runs,
    publish,
    autoPublish,
    setAutoPublish,
    reuse,
    error: localError ?? runs.error,
    authReason,
    setAuthReason,
    upgradeReason,
    setUpgradeReason,
  }
}

export type Composer = ReturnType<typeof useComposer>
