import { t2v, videoModel } from "../defaults"

// Hive Studio (decisions D-034): the template declared a start-frame slot, but
// its only path is text-to-video and t2v() can't derive an image path from
// ".../text-to-video/fast", so attached frames were silently dropped. The slot
// is removed until an LTX image-to-video path is verified on docs.higgsfield.ai.

export default videoModel(
  "ltx-2.5-pro",
  "LTX 2.5 Pro",
  {},
  t2v("lightricks/ltx-2.5/text-to-video/pro"),
  { icon: "ltx", order: 64 }
)
