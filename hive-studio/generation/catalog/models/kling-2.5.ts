import { videoModel } from "../defaults"
import type { ModelEntry } from "../types"

// Hive Studio (decisions D-034): the only path the template declares for this
// model takes frames/an image, so a start frame is required; a prompt-only run
// would be sent to a frame endpoint and fail. Source: template model file
// (higgsfield-ai/app-templates). Re-check against docs.higgsfield.ai.

export default {
  ...videoModel(
    "kling-2.5",
    "Kling 2.5",
    { start: 1 },
    { image: "kling-video/v2.5-turbo/standard/image-to-video" },
    { icon: "kling", order: 60 }
  ),
  requiredRoles: ["start"],
} satisfies ModelEntry
