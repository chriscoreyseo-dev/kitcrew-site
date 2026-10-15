/** Model-picker copy and badges, in our own words. Providers are named by
    model family; the platform vendor's own name and logo never appear (spec §1d). (drafted from the
    higgsfield-ai/skills model catalog and the template settings; see
    docs/model-catalog.md §4). Badges are only set where a setting, path or the
    skills guidance supports them; version-number guesses ("NEW") are left out
    until confirmed. Kept apart from the model files so those stay template-shaped. */

export type ModelBadge = "NEW" | "TOP" | "FAST" | "4K" | "AUDIO"

export type ModelMeta = {
  provider: string
  description: string
  bestFor?: string
  badges?: ModelBadge[]
}

export const MODEL_META: Record<string, ModelMeta> = {
  "soul-2": {
    provider: "Soul",
    description: "Still-image model tuned for people and styled portraits.",
    bestFor: "Editorial, lifestyle and fashion images of people.",
    badges: ["TOP"],
  },
  "soul-cinema": {
    provider: "Soul",
    description: "Soul with a filmic look and dramatic lighting.",
    bestFor: "Movie-still frames and moody concept art.",
  },
  "seedance-2.5": {
    provider: "ByteDance",
    description:
      "All-round video from text, frames or image, video and audio references, 4–30 s.",
    bestFor: "Most video briefs: motion, multi-shot scenes, image-to-video.",
    badges: ["TOP", "AUDIO"],
  },
  "seedance-2.5-edit": {
    provider: "ByteDance",
    description:
      "Changes a clip you already have from a prompt and optional references.",
    bestFor: "Restyling or altering an existing video.",
    badges: ["AUDIO"],
  },
  "seedance-2.5-extend": {
    provider: "ByteDance",
    description: "Continues an existing clip by 4–30 s in the same scene.",
    bestFor: "Making a clip longer.",
    badges: ["AUDIO"],
  },
  "seedance-2": {
    provider: "ByteDance",
    description: "Earlier Seedance with the same inputs and up to 4K output.",
    bestFor: "Video briefs that need 4K.",
    badges: ["4K", "AUDIO"],
  },
  "seedance-2-fast": {
    provider: "ByteDance",
    description: "Faster Seedance 2.0 tier, up to 720p.",
    bestFor: "Quick drafts and iterations.",
    badges: ["FAST", "AUDIO"],
  },
  "seedance-2-mini": {
    provider: "ByteDance",
    description: "Lightweight Seedance 2.0 tier, up to 720p.",
    bestFor: "Lower-cost runs with references.",
    badges: ["AUDIO"],
  },
  "kling-3-turbo": {
    provider: "Kling",
    description:
      "Quick Kling 3.0 tier: text-to-video or one animated frame, 3–15 s.",
    bestFor: "Simple motion when speed or cost matters.",
    badges: ["FAST"],
  },
  "kling-3-std": {
    provider: "Kling",
    description: "Kling 3.0 with start and end frames, sound and multi-shot.",
    bestFor: "Frame-to-frame transitions at a lower cost.",
    badges: ["AUDIO"],
  },
  "kling-3-pro": {
    provider: "Kling",
    description: "Higher-quality Kling 3.0 with the same controls.",
    bestFor: "The Standard use cases, at higher quality.",
    badges: ["AUDIO"],
  },
  "kling-3-4k": {
    provider: "Kling",
    description: "Kling 3.0 rendered at 4K.",
    bestFor: "4K output from the Kling family.",
    badges: ["4K", "AUDIO"],
  },
  "kling-3-motion-std": {
    provider: "Kling",
    description:
      "Moves a character from your image using motion from a reference video.",
    bestFor: "Putting a dance or movement on your own character.",
  },
  "kling-3-motion-pro": {
    provider: "Kling",
    description: "Higher-quality Kling motion control.",
    bestFor: "Motion transfer at higher quality.",
  },
  "flux-2": {
    provider: "Black Forest Labs",
    description: "Image model that follows prompts closely.",
    bestFor: "A different look when other models feel generic.",
  },
  "grok-imagine-2": {
    provider: "xAI",
    description: "Image model with a bold, high-contrast style.",
    bestFor: "Stylized and experimental images.",
  },
  "ideogram-4": {
    provider: "Ideogram",
    description: "Text-to-image with up to 8 references.",
  },
  "recraft-4.1": {
    provider: "Recraft",
    description: "Design-oriented image model.",
    bestFor: "Logos, icons, flat illustration and brand marks.",
  },
  "qwen-image-3": {
    provider: "Alibaba",
    description: "Qwen text-to-image with up to 8 references.",
  },
  "z-image-turbo": {
    provider: "Z-Image",
    description: "Speed-first image model.",
    bestFor: "Fast, cheap drafts.",
    badges: ["FAST"],
  },
  "wan-3": {
    provider: "Alibaba",
    description: "Wan 3.0 text- and image-to-video.",
  },
  "wan-3-prime": {
    provider: "Alibaba",
    description: "Higher tier of Wan 3.0.",
  },
  "wan-2.7": {
    provider: "Alibaba",
    description: "Wan 2.7 text- and image-to-video.",
    bestFor: "Character-consistent clips.",
  },
  "wan-2.6": {
    provider: "Alibaba",
    description: "Wan 2.6 text- and image-to-video.",
    bestFor: "Low-cost, artistic or experimental clips.",
  },
  "flux-3": {
    provider: "Black Forest Labs",
    description: "Flux text- and image-to-video.",
  },
  "minimax-h3": {
    provider: "MiniMax",
    description: "MiniMax H3 text- and image-to-video.",
  },
  "minimax-hailuo-2.3": {
    provider: "MiniMax",
    description: "Hailuo text- and image-to-video.",
    bestFor: "Budget motion with believable physics.",
  },
  "happy-horse-1": {
    provider: "Alibaba",
    description: "Happy Horse 1.0 text- and image-to-video.",
  },
  "happy-horse-1.1": {
    provider: "Alibaba",
    description: "Happy Horse 1.1 text- and image-to-video.",
  },
  "kling-2.6": {
    provider: "Kling",
    description: "Earlier Kling release, text- and image-to-video.",
    bestFor: "Cinematic motion with physical realism.",
  },
  "kling-2.5": {
    provider: "Kling",
    description: "Kling 2.5 Turbo: animates one start frame.",
    bestFor: "Bringing a single image to life.",
  },
  "kling-o3": {
    provider: "Kling",
    description: "Transition video between a first and a last frame.",
    bestFor: "Morphs and transitions between two images.",
  },
  "kling-o1": {
    provider: "Kling",
    description: "Omni first-to-last-frame video.",
    bestFor: "Morphs and transitions between two images.",
  },
  "ltx-2.5-fast": {
    provider: "Lightricks",
    description: "LTX 2.5 fast tier, text-to-video.",
    bestFor: "Quick drafts.",
    badges: ["FAST"],
  },
  "ltx-2.5-pro": {
    provider: "Lightricks",
    description: "LTX 2.5 pro tier, text-to-video.",
  },
  "grok-imagine-video-1.5": {
    provider: "xAI",
    description: "Video driven by image and video references.",
    bestFor: "Stylized, high-contrast motion from references.",
  },
  "pixverse-6": {
    provider: "PixVerse",
    description: "PixVerse 6 text- and image-to-video.",
  },
  dop: {
    provider: "DoP",
    description: "DoP (lite): animates one still image with camera motion.",
    bestFor: "Animating a single image.",
  },
}

export function modelMeta(id: string): ModelMeta | undefined {
  return MODEL_META[id]
}
