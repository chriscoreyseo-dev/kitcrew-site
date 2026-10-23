import { urls } from "../mappers"
import type { GenerationPlane, ModelEntry, PlatformRequest } from "../types"

// Hive Studio (S611, Chris: "let's add Genjutsu as a model"). Motion transfer:
// the motion of the member's video is redrawn onto the look of their reference
// images. Request body per the Higgsfield API reference for
// higgsfield/genjutsu/motion-transfer/v1.0 (read via search 2026-10-23; the docs
// hosts are blocked from the cloud sandbox, so re-check against docs.higgsfield.ai):
// video_url (required, 4s minimum, trimmed to 30s), image_urls (required, 1-8),
// prompt (optional, up to 10,000 chars), resolution 480p/720p/1080p (default 720p).

const genjutsuSettings = {
  resolution: {
    type: "enum",
    values: ["480p", "720p", "1080p"],
    default: "720p",
  },
} as const satisfies ModelEntry["settings"]

function mapGenjutsu(plane: GenerationPlane): PlatformRequest {
  const video = urls(plane, "video")[0]
  const prompt = plane.prompt.text.trim()
  return {
    path: "higgsfield/genjutsu/motion-transfer/v1.0",
    body: {
      ...(video ? { video_url: video } : {}),
      image_urls: urls(plane, "reference").slice(0, 8),
      ...(prompt ? { prompt } : {}),
      resolution: plane.settings.resolution,
    },
  }
}

const genjutsu: ModelEntry = {
  id: "genjutsu",
  surface: "video",
  label: "Genjutsu",
  roles: { video: 1, reference: 8 },
  requiredRoles: ["video", "reference"],
  settings: genjutsuSettings,
  order: 36,
  toPlatform: mapGenjutsu,
}

export default genjutsu
