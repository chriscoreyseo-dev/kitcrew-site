"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ModelEntry, Surface } from "@/generation/catalog/types"
import {
  adminCreatePresetAction,
  adminDeletePresetAction,
  adminSetPresetActiveAction,
  adminUpdatePresetAction,
} from "@/generation/admin-actions"
import type { AdminPresetRow } from "@/lib/admin"

import { ErrorText, selectClass, textareaClass } from "./ui"
import { useAdminAction } from "./use-admin-action"

export type PresetModelOption = {
  id: string
  label: string
  surface: Surface
  settings: ModelEntry["settings"]
}

const SURFACES: Surface[] = ["image", "video", "audio"]

export function NewPresetButton({ models }: { models: PresetModelOption[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New effect
      </Button>
      {open ? (
        <PresetDialog open={open} onOpenChange={setOpen} models={models} />
      ) : null}
    </>
  )
}

export function PresetRowActions({
  preset,
  models,
}: {
  preset: AdminPresetRow
  models: PresetModelOption[]
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const toggle = useAdminAction()
  const remove = useAdminAction()
  const error = toggle.error ?? remove.error
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${preset.title}`}
          title="Edit"
          onClick={() => setOpen(true)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={toggle.pending}
          onClick={() =>
            toggle.execute(() =>
              adminSetPresetActiveAction({
                id: preset.id,
                active: !preset.active,
              })
            )
          }
        >
          {preset.active ? "Deactivate" : "Activate"}
        </Button>
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.pending}
              onClick={() =>
                remove.execute(() => adminDeletePresetAction(preset.id))
              }
            >
              {remove.pending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${preset.title}`}
            title="Delete"
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {open ? (
        <PresetDialog
          open={open}
          onOpenChange={setOpen}
          models={models}
          preset={preset}
        />
      ) : null}
    </div>
  )
}

function PresetDialog({
  open,
  onOpenChange,
  models,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  models: PresetModelOption[]
  preset?: AdminPresetRow
}) {
  const first = models[0]
  const [slug, setSlug] = useState(preset?.slug ?? "")
  const [title, setTitle] = useState(preset?.title ?? "")
  const [description, setDescription] = useState(preset?.description ?? "")
  const [surface, setSurface] = useState<Surface>(
    preset?.surface ?? first?.surface ?? "image"
  )
  const [modelId, setModelId] = useState(preset?.modelId ?? first?.id ?? "")
  const [promptTemplate, setPromptTemplate] = useState(
    preset?.promptTemplate ?? ""
  )
  const [settingsText, setSettingsText] = useState(
    JSON.stringify(preset?.settings ?? {}, null, 2)
  )
  const [coverUrl, setCoverUrl] = useState(preset?.coverUrl ?? "")
  const [category, setCategory] = useState(preset?.category ?? "")
  const [order, setOrder] = useState(String(preset?.order ?? 0))
  const [active, setActive] = useState(preset?.active ?? false)
  const { pending, error, setError, execute } = useAdminAction()

  const surfaceModels = models.filter((m) => m.surface === surface)
  const model = models.find((m) => m.id === modelId)

  function changeSurface(next: Surface) {
    setSurface(next)
    if (model?.surface !== next)
      setModelId(models.find((m) => m.surface === next)?.id ?? "")
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let settings: unknown
    try {
      settings = JSON.parse(settingsText || "{}")
    } catch {
      setError("Settings must be valid JSON.")
      return
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      setError('Settings must be a JSON object, e.g. { "duration": 5 }.')
      return
    }
    const orderValue = Number(order)
    if (!Number.isInteger(orderValue)) {
      setError("Order must be a whole number.")
      return
    }
    const input = {
      slug: slug.trim(),
      title,
      description,
      surface,
      modelId,
      promptTemplate,
      settings,
      coverUrl: coverUrl.trim(),
      category,
      order: orderValue,
      active,
    }
    execute(
      () =>
        preset
          ? adminUpdatePresetAction(preset.id, input)
          : adminCreatePresetAction(input),
      () => onOpenChange(false)
    )
  }

  const id = (name: string) => `preset-${preset?.id ?? "new"}-${name}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>
              {preset ? `Edit ${preset.title}` : "New effect"}
            </DialogTitle>
            <DialogDescription>
              Opens a generator pre-filled. Use {"{subject}"} in the prompt
              where the user&apos;s subject goes.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor={id("title")}>
                <Input
                  id={id("title")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Slug (a-z, 0-9, dashes)" htmlFor={id("slug")}>
                <Input
                  id={id("slug")}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  maxLength={64}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
              </Field>
              <Field label="Surface" htmlFor={id("surface")}>
                <select
                  id={id("surface")}
                  className={selectClass}
                  value={surface}
                  onChange={(e) =>
                    changeSurface(
                      SURFACES.find((s) => s === e.target.value) ?? "image"
                    )
                  }
                >
                  {SURFACES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model" htmlFor={id("model")}>
                <select
                  id={id("model")}
                  className={selectClass}
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  required
                >
                  {surfaceModels.length === 0 ? (
                    <option value="">No {surface} models</option>
                  ) : null}
                  {surfaceModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category" htmlFor={id("category")}>
                <Input
                  id={id("category")}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={40}
                  required
                />
              </Field>
              <Field label="Order (lower first)" htmlFor={id("order")}>
                <Input
                  id={id("order")}
                  inputMode="numeric"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Description (optional)"
                  htmlFor={id("description")}
                >
                  <Input
                    id={id("description")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={300}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Prompt template" htmlFor={id("prompt")}>
                  <textarea
                    id={id("prompt")}
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    required
                    className={textareaClass}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Cover URL (https, optional)"
                  htmlFor={id("cover")}
                >
                  <Input
                    id={id("cover")}
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    maxLength={2000}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Settings (JSON)" htmlFor={id("settings")}>
                  <textarea
                    id={id("settings")}
                    value={settingsText}
                    onChange={(e) => setSettingsText(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    className={textareaClass}
                  />
                </Field>
                {model && Object.keys(model.settings).length ? (
                  <p className="mt-1 text-xs break-words text-muted-foreground">
                    {Object.entries(model.settings)
                      .map(([name, f]) =>
                        f.type === "enum"
                          ? `${name}: ${f.values.join(" | ")}`
                          : f.type === "range"
                            ? `${name}: ${f.min}–${f.max}`
                            : `${name}: true | false`
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="size-4 accent-current"
                />
                Active (shown on the effects pages)
              </label>
              {error ? (
                <div className="sm:col-span-2">
                  <ErrorText>{error}</ErrorText>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : preset ? "Save effect" : "Create effect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
