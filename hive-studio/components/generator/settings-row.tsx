"use client"

import { SlidersHorizontal } from "lucide-react"

import { headlineSetting } from "@/components/studio/studio-prompt-box"
import {
  SettingsDialog,
  settingLabel,
} from "@/components/studio/settings-dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ModelEntry } from "@/generation/catalog"
import { parseSettings } from "@/generation/catalog"

/** Headline setting pill + resolution pill + "More" (every setting). */
export function SettingsRow({
  model,
  values,
  onChange,
}: {
  model: ModelEntry
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  const parsed = parseSettings(model, values)
  const headline = headlineSetting(model)
  const pills = [headline, "resolution"].filter(
    (key, i, all): key is string =>
      Boolean(key) &&
      all.indexOf(key) === i &&
      model.settings[key!]?.type === "enum"
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map((key) => {
        const field = model.settings[key]
        if (field?.type !== "enum") return null
        return (
          <Select
            key={key}
            value={String(parsed[key])}
            onValueChange={(v) => onChange(key, v)}
          >
            <SelectTrigger
              size="sm"
              className="w-auto min-w-20"
              aria-label={settingLabel(key)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent variant="picker" surface="solid" align="start">
              {field.values.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
      {Object.keys(model.settings).length > pills.length ? (
        <SettingsDialog
          model={model}
          values={parsed}
          onChange={onChange}
          trigger={
            <Button variant="outline" size="sm" aria-label="More settings">
              <SlidersHorizontal aria-hidden />
              More
            </Button>
          }
        />
      ) : null}
    </div>
  )
}
