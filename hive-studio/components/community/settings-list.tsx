/** Read-only model settings as label/value rows. */

const LABELS: Record<string, string> = {
  aspectRatio: "Aspect ratio",
  aspect_ratio: "Aspect ratio",
  batchSize: "Batch",
  generateAudio: "Audio",
  sound: "Audio",
  cfgScale: "Prompt strength",
  bitrateMode: "Bitrate",
  enhancePrompt: "Prompt enhance",
  multiShots: "Multi-shot",
}

function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key]
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function valueFor(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (key === "duration" && typeof value === "number") return `${value}s`
  return String(value)
}

export function SettingsList({
  settings,
}: {
  settings: Record<string, unknown>
}) {
  const entries = Object.entries(settings).filter(
    ([, v]) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  )
  if (!entries.length) return null
  return (
    <dl className="grid grid-cols-2 gap-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          <dt className="truncate text-[11px] tracking-wide text-muted-foreground uppercase">
            {labelFor(key)}
          </dt>
          <dd className="truncate font-mono text-sm">{valueFor(key, value)}</dd>
        </div>
      ))}
    </dl>
  )
}
