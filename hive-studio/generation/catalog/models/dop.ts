import { videoModel } from "../defaults"
import type { ModelEntry } from "../types"

// Hive Studio (decisions D-034): the only path the template declares for this
// model takes frames/an image, so a start frame is required; a prompt-only run
// would be sent to a frame endpoint and fail. Source: template model file
// (higgsfield-ai/app-templates). Re-check against docs.higgsfield.ai.

export default {
  ...videoModel(
    "dop",
    "DoP",
    { start: 1 },
    { image: "higgsfield-ai/dop/lite" },
    {
      icon: "higgsfield",
      order: 67,
    }
  ),
  requiredRoles: ["start"],
} satisfies ModelEntry
