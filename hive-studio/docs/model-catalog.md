# Model Catalog (Higgsfield REST wrapper)

> **Phase 4 update (2026-10-15):** fixed per decisions D-034. Kling O1/O3, Kling 2.5 and DoP now require a start frame; the start slot was removed from LTX 2.5 Fast/Pro. Picker copy now lives in `generation/catalog/metadata.ts` (tentative badges dropped). Open questions 5 and 6 below are resolved for the UI; the underlying endpoints still need checking against the docs.


Date: 2026-10-15

## 1. Intro

This catalog plans the model list for an app that wraps the Higgsfield REST API. It was built **only from local files** under `studio/_reference/`:

- **App template** (`app-templates/generation/catalog/`): `models/*.ts`, `models/registry.json`, `types.ts`, `mappers.ts`, `defaults.ts`, `tokens.ts`, plus `generation/platform.ts` and `generation/to-platform.ts` for the request shape. This is the only source of REST paths.
- **CLI model list** (`cli/MODELS.md`): CLI job-set types and flags. These names (e.g. `nano_banana_2`, `seedance_2_0`) belong to a **different API** (the CLI job-set API). They are **not** REST paths, and this document never uses them as REST paths.
- **Skills** (`skills/higgsfield-generate/references/model-catalog.md`, `prompt-engineering.md`, `media-inputs.md`, plus `SKILL.md`): used for the "best for" guidance, reworded here.

**Verification caveat:** the live docs (docs.higgsfield.ai) and the console (higgsfield.ai) could not be reached, so **nothing here was checked against them**. "Live (template-verified)" only means the REST path and settings appear in the template code. The template's own `AGENTS.md` says installed models should stay visible "when their live API behavior is unverified", so being in the template does not prove a model was tested live. Recheck every row against the docs before shipping.

**Request shape in the template** (`generation/platform.ts`): `POST {HF_API_BASE_URL}/{path}` with a JSON body, then `GET /requests/{request_id}/status` and `POST /requests/{request_id}/cancel`. Uploads go through `POST /files/generate-upload-url`. `HF_API_BASE_URL` defaults to `https://api.higgsfield.ai`.

---

## 2. Template catalog (REST path known)

All source paths are relative to `studio/_reference/app-templates/generation/catalog/models/`.

**Shorthand for shared defaults** (from `defaults.ts`; these models use them unchanged):

- **IMG-DEF** (`imageModel()`): roles `reference: 8`; `aspectRatio` enum `auto/1:1/4:3/3:4/16:9/9:16` (default `1:1`); `resolution` enum `1k/2k/4k` (default `1k`). The generic mapper sends references as `image_urls`.
- **VID-DEF** (`videoModel()`): `aspectRatio` enum `16:9/9:16/1:1` (default `16:9`); `resolution` enum `720p/1080p` (default `720p`); `duration` range 4–10 (default 5). Body keys: `prompt`, `aspect_ratio`, `resolution`, `duration`, plus `image_url` (image path) or `first_frame_url`/`last_frame_url` (first-last path).
- **SEEDANCE_ASPECT** (`tokens.ts`): `16:9/4:3/1:1/3:4/9:16/21:9`. **SOUL_ASPECT**: `9:16/16:9/4:3/3:4/1:1/2:3/3:2`.
- **"(derived)"**: the source file only gives the `.../text-to-video` path. The template's `t2v()` helper computes the image path by swapping the suffix to `/image-to-video`. The derived path is shown exactly as computed, but it is not written literally in the source.
- `requirePrompt`: "—" means not set. The UI still needs a prompt or at least one media item for every model (`layouts/studio.tsx`).

| id | label | surface | family | REST path(s) | input modes / media roles (max) | settings (values; default) | requirePrompt | source file | status |
|---|---|---|---|---|---|---|---|---|---|
| `soul-2` | Soul 2 | image | Higgsfield Soul | `higgsfield-ai/soul/v2/standard` | none (roles `{}`) | aspectRatio SOUL_ASPECT; `1:1` · resolution `720p/1080p`; `720p` · batchSize `"1"/"4"`; `"1"` (sent as number `batch_size`) · enhancePrompt bool; false | — | `soul.ts` | Live (template-verified; recheck vs docs) |
| `soul-cinema` | Soul Cinema | image | Higgsfield Soul | `higgsfield-ai/soul/cinema` | none (roles `{}`) | same as soul-2 | — | `soul.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2.5` | Seedance 2.5 | video | Seedance (ByteDance) | `bytedance/seedance-2.5/text-to-video`, `bytedance/seedance-2.5/image-to-video`, `bytedance/seedance-2.5/reference-to-video` | mode `frames`: start 1, end 1 · mode `references`: reference 30, video 10, audio 10 (requireAny). Frames and references cannot be mixed; end needs start | aspectRatio SEEDANCE_ASPECT; `16:9` · duration 4–30; 5 · resolution `480p/720p`; `720p` · generateAudio bool; true · bitrateMode `standard/high`; `high` | — | `seedance-2.5.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2.5-edit` | Seedance 2.5 Edit | video | Seedance (ByteDance) | `bytedance/seedance-2.5/video-edit` | source 1 (required), video 10, reference 30, audio 10 | resolution `480p/720p`; `720p` · generateAudio bool; true · bitrateMode `standard/high`; `high` (no duration, no aspect) | true | `seedance-2.5.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2.5-extend` | Seedance 2.5 Extend | video | Seedance (ByteDance) | `bytedance/seedance-2.5/video-extend` | source 1 (required), video 10, reference 30, audio 10 | duration 4–30; 5 · resolution `480p/720p`; `720p` · generateAudio bool; true · bitrateMode `standard/high`; `high` | true | `seedance-2.5.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2` | Seedance 2.0 | video | Seedance (ByteDance) | `bytedance/seedance-2.0/text-to-video`, `bytedance/seedance-2.0/image-to-video`, `bytedance/seedance-2.0/reference-to-video` | mode `frames`: start 1, end 1 · mode `references`: reference 9, video 3, audio 3 (requireAny) | aspectRatio SEEDANCE_ASPECT; `16:9` · duration 4–15; 5 · generateAudio bool; true · resolution `480p/720p/1080p/4k`; `720p` | — | `seedance-2.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2-fast` | Seedance 2.0 Fast | video | Seedance (ByteDance) | `bytedance/seedance-2.0/fast/text-to-video`, `bytedance/seedance-2.0/fast/image-to-video`, `bytedance/seedance-2.0/fast/reference-to-video` | same as seedance-2 | as seedance-2, but resolution `480p/720p`; `720p` | — | `seedance-2.ts` | Live (template-verified; recheck vs docs) |
| `seedance-2-mini` | Seedance 2.0 Mini | video | Seedance (ByteDance) | `bytedance/seedance-2.0/mini/text-to-video`, `bytedance/seedance-2.0/mini/image-to-video`, `bytedance/seedance-2.0/mini/reference-to-video` | same as seedance-2 | as seedance-2, but resolution `480p/720p`; `720p` | — | `seedance-2.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-turbo` | Kling 3.0 Turbo | video | Kling | `kling-video/v3.0-turbo/text-to-video`, `kling-video/v3.0-turbo/image-to-video` | start 1 | aspectRatio `16:9/9:16/1:1`; `16:9` (text path only) · resolution `720p/1080p`; `720p` · duration 3–15; 5 | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-std` | Kling 3.0 Standard | video | Kling | `kling-video/v3.0/std/text-to-video`, `kling-video/v3.0/std/image-to-video` | start 1, end 1 (end sent as `last_image_url`) | aspectRatio `16:9/9:16/1:1`; `16:9` · duration 3–15; 5 · sound bool; true (sent `"on"/"off"`) · cfgScale 0–1 step 0.01; 0.5 · multiShots bool; false | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-pro` | Kling 3.0 Pro | video | Kling | `kling-video/v3.0/pro/text-to-video`, `kling-video/v3.0/pro/image-to-video` | start 1, end 1 | same as kling-3-std | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-4k` | Kling 3.0 4K | video | Kling | `kling-video/v3.0/4k/text-to-video`, `kling-video/v3.0/4k/image-to-video` | start 1, end 1 | same as kling-3-std | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-motion-std` | Kling 3.0 Motion Control | video | Kling | `kling-video/v3/motion-control/std` | start 1, video 1 | keepOriginalSound bool; true (sent `"yes"/"no"`) · characterOrientation `video/image`; `video` | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `kling-3-motion-pro` | Kling 3.0 Motion Control Pro | video | Kling | `kling-video/v3/motion-control/pro` | start 1, video 1 | same as kling-3-motion-std | — | `kling-3.ts` | Live (template-verified; recheck vs docs) |
| `flux-2` | Flux 2 | image | Flux (Black Forest Labs) | `flux-2-pro` | IMG-DEF (reference 8) | IMG-DEF | — | `flux-2.ts` | Live (template-verified; recheck vs docs) |
| `grok-imagine-2` | Grok Imagine 2.0 | image | Grok (xAI) | `xai/grok-imagine-image-2.0` | IMG-DEF (reference 8) | IMG-DEF | — | `grok-imagine-2.ts` | Live (template-verified; recheck vs docs) |
| `ideogram-4` | Ideogram 4.0 | image | Ideogram | `ideogram/v4.0` | IMG-DEF (reference 8) | IMG-DEF | — | `ideogram-4.ts` | Live (template-verified; recheck vs docs) |
| `recraft-4.1` | Recraft 4.1 | image | Recraft | `recraft/v4.1/text-to-image` | IMG-DEF (reference 8) | IMG-DEF | — | `recraft-4.1.ts` | Live (template-verified; recheck vs docs) |
| `qwen-image-3` | Qwen Image 3 | image | Qwen (Alibaba) | `alibaba/qwen-image-3/text-to-image` | IMG-DEF (reference 8) | IMG-DEF | — | `qwen-image-3.ts` | Live (template-verified; recheck vs docs) |
| `z-image-turbo` | Z-Image Turbo | image | Z-Image | `z-image/turbo` | IMG-DEF (reference 8) | IMG-DEF | — | `z-image-turbo.ts` | Live (template-verified; recheck vs docs) |
| `wan-3` | Wan 3.0 | video | Wan (Alibaba) | `alibaba/wan-3.0/text-to-video`, `alibaba/wan-3.0/image-to-video` (derived) | start 1 | VID-DEF | — | `wan-3.ts` | Live (template-verified; recheck vs docs) |
| `wan-3-prime` | Wan 3.0 Prime | video | Wan (Alibaba) | `alibaba/wan-3.0-prime/text-to-video`, `alibaba/wan-3.0-prime/image-to-video` (derived) | start 1 | VID-DEF | — | `wan-3-prime.ts` | Live (template-verified; recheck vs docs) |
| `wan-2.7` | Wan 2.7 | video | Wan | `wan/v2.7/text-to-video`, `wan/v2.7/image-to-video` (derived) | start 1 | VID-DEF | — | `wan-2.7.ts` | Live (template-verified; recheck vs docs) |
| `wan-2.6` | Wan 2.6 | video | Wan | `wan/v2.6/text-to-video`, `wan/v2.6/image-to-video` (derived) | start 1 | VID-DEF | — | `wan-2.6.ts` | Live (template-verified; recheck vs docs) |
| `flux-3` | Flux 3 | video | Flux (Black Forest Labs) | `blackforestlabs/flux-3/text-to-video`, `blackforestlabs/flux-3/image-to-video` (derived) | start 1 | VID-DEF | — | `flux-3.ts` | Live (template-verified; recheck vs docs) |
| `minimax-h3` | MiniMax H3 | video | MiniMax | `minimax/h3/text-to-video`, `minimax/h3/image-to-video` (derived) | start 1 | VID-DEF | — | `minimax-h3.ts` | Live (template-verified; recheck vs docs) |
| `minimax-hailuo-2.3` | MiniMax Hailuo 2.3 | video | MiniMax | `minimax/hailuo-2.3/standard/text-to-video`, `minimax/hailuo-2.3/standard/image-to-video` (derived) | start 1 | VID-DEF | — | `minimax-hailuo-2.3.ts` | Live (template-verified; recheck vs docs) |
| `happy-horse-1` | Happy Horse 1.0 | video | Happy Horse (Alibaba) | `alibaba/happy-horse/text-to-video`, `alibaba/happy-horse/image-to-video` (derived) | start 1 | VID-DEF | — | `happy-horse-1.ts` | Live (template-verified; recheck vs docs) |
| `happy-horse-1.1` | Happy Horse 1.1 | video | Happy Horse (Alibaba) | `alibaba/happy-horse/v1.1/text-to-video`, `alibaba/happy-horse/v1.1/image-to-video` (derived) | start 1 | VID-DEF | — | `happy-horse-1.1.ts` | Live (template-verified; recheck vs docs) |
| `kling-2.6` | Kling 2.6 | video | Kling | `kling-video/v2.6/pro/text-to-video`, `kling-video/v2.6/pro/image-to-video` (derived) | start 1 | VID-DEF | — | `kling-2.6.ts` | Live (template-verified; recheck vs docs) |
| `kling-2.5` | Kling 2.5 | video | Kling | `kling-video/v2.5-turbo/standard/image-to-video` (image path only) | start 1 | VID-DEF | — | `kling-2.5.ts` | Live (template-verified; recheck vs docs) |
| `kling-o3` | Kling O3 | video | Kling | `kling-video/o3/first-last-frame` (first-last path only) | start 1, end 1 (sent as `first_frame_url` / `last_frame_url`) | VID-DEF | — | `kling-o3.ts` | Live (template-verified; recheck vs docs) |
| `kling-o1` | Kling O1 (Omni) | video | Kling | `kling-video/omni/first-last-frame` (first-last path only) | start 1, end 1 | VID-DEF | — | `kling-o1.ts` | Live (template-verified; recheck vs docs) |
| `ltx-2.5-fast` | LTX 2.5 Fast | video | LTX (Lightricks) | `lightricks/ltx-2.5/text-to-video/fast` (text path only; `t2v()` derives no image path because the path does not end in `/text-to-video`) | start 1 declared, but the mapper never sends it (see Open questions) | VID-DEF | — | `ltx-2.5-fast.ts` | Live (template-verified; recheck vs docs) |
| `ltx-2.5-pro` | LTX 2.5 Pro | video | LTX (Lightricks) | `lightricks/ltx-2.5/text-to-video/pro` (text path only) | start 1 declared, never sent | VID-DEF | — | `ltx-2.5-pro.ts` | Live (template-verified; recheck vs docs) |
| `grok-imagine-video-1.5` | Grok Imagine Video 1.5 | video | Grok (xAI) | `xai/grok-imagine-video/v1.5/reference-to-video` | reference 8, video 3 (sent as `image_urls` / `video_urls`) | VID-DEF | — | `grok-imagine-video-1.5.ts` | Live (template-verified; recheck vs docs) |
| `pixverse-6` | PixVerse 6 | video | PixVerse | `pixverse/v6/text-to-video`, `pixverse/v6/image-to-video` (derived) | start 1 | VID-DEF | — | `pixverse-6.ts` | Live (template-verified; recheck vs docs) |
| `dop` | DoP | video | Higgsfield DoP | `higgsfield-ai/dop/lite` (image path only) | start 1 | VID-DEF | — | `dop.ts` | Live (template-verified; recheck vs docs) |

Totals: **38 entries** (8 image, 30 video) from 28 files. This matches `registry.json` (`meta.ids`) and `models.generated.ts`.

### 2a. Probable CLI counterparts of template entries (name match only)

These CLI/skills models are left out of Table 3 because a template entry probably covers them. Every match is **by display name only and unconfirmed**. Parameter names and value sets often differ (see Open questions).

| template id(s) | CLI job-set name (MODELS.md / skills) | match confidence |
|---|---|---|
| soul-2 | `text2image_soul_v2` (Higgsfield Soul V2) | medium |
| soul-cinema | `soul_cinematic` (CLI label "Soul Cinematic", skills label "Soul Cinema") | medium |
| seedance-2.5, -edit, -extend | `seedance_2_5` (skills only; modes `t2v`/`omni_reference`/`video_edit`/`video_extension`) | medium |
| seedance-2, seedance-2-fast | `seedance_2_0` (`--mode std/fast`) | high |
| seedance-2-mini | `seedance_2_0_mini` | high |
| kling-3-turbo | `kling3_0_turbo` | high |
| kling-3-std / -pro / -4k | `kling3_0` (`--mode std/pro/4k`) | high |
| flux-2 | `flux_2` (`--variant pro`) | medium |
| grok-imagine-2 | `grok_image_2_0` (skills, unprofiled) | low |
| recraft-4.1 | `recraft_v4_1` | high |
| wan-3 / wan-3-prime | `wan3_0` / `wan3_0_prime` (skills, unprofiled) | medium |
| wan-2.7 / wan-2.6 | `wan2_7` / `wan2_6` | high |
| flux-3 | `flux_3_video` (skills, unprofiled) | medium |
| minimax-h3 | `minimax_h3` (skills, unprofiled) | medium |
| minimax-hailuo-2.3 | `minimax_hailuo` with `--variant minimax-2.3` | medium |
| happy-horse-1 / 1.1 | `happy_horse_video` (skills, unprofiled; version unknown) | low |
| kling-2.6 | `kling2_6` | high |
| grok-imagine-video-1.5 | `grok_video_v15` (input shape differs: CLI needs a start image, template is reference-to-video) | low |
| kling-3-motion-*, ideogram-4, qwen-image-3, z-image-turbo, kling-2.5, kling-o1, kling-o3, ltx-2.5-*, pixverse-6, dop | none found (`z_image` might be z-image-turbo; it is listed in Table 3) | — |

---

## 3. In CLI/skills but no REST path known

None of these has a REST path in any local template file. The CLI job-set name is **not** a REST path. "Source" gives where the model appears: M = `cli/MODELS.md`, S = skills `model-catalog.md`/`media-inputs.md`.

| # | name | surface | CLI job-set name | key params (CLI flags as documented) | source | status |
|---|---|---|---|---|---|---|
| 1 | Cinematic Studio 2.5 (skills: "Cinema Studio Image 2.5") | image | `cinematic_studio_2_5` | aspect_ratio 10 values (def `1:1`); batch_size int (def 1); mode (def `auto`); resolution `1k/2k/4k` (def `1k`); image refs 0..14 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 2 | Flux Kontext (skills: "Flux Kontext Max") | image | `flux_kontext` | aspect_ratio `1:1/4:3/3:4/16:9/9:16`; image refs 0..4 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 3 | GPT Image 1.5 | image | not given | none documented locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 4 | GPT Image 2 | image | `gpt_image_2` | aspect_ratio 11 values incl. `auto`; background `auto/opaque/transparent`; quality `low/medium/high` (def `high`); resolution `1k/2k/4k` (def `2k`); is_inpaint + mask; image refs repeated | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 5 | GPT Image 2.5 | image | `gpt_image_2_5` | aspect_ratio 15 values; background; quality `low/medium/high/xhigh/max` (def `low`); resolution `1k/2k/4k` (def `1k`); variant `flare/sunburst` (def `flare`); image refs ≤16 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 6 | Grok Image (skills: "Grok Imagine") | image | `grok_image` | aspect_ratio 10 values incl. `auto/1:2/2:1`; mode `std/quality`; resolution `1k/2k`; image refs repeated | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 7 | Image Auto (skills: "Auto" router) | image | `image_auto` | aspect_ratio 5 values; image refs 0..14 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 8 | Image Background Remover | image | `image_background_remover` | exactly 1 image ref | M | Unverified – REST path needed from docs.higgsfield.ai |
| 9 | Kling O1 Image | image | `kling_omni_image` | aspect_ratio 9 values incl. `auto` (needs ≥1 ref); resolution `1k/2k`; image refs 0..10 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 10 | Marketing Studio Image | image | `marketing_studio_image` | aspect_ratio 11 values; resolution `1k/2k/4k`; image refs 0..14; prompt or ≥1 ref | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 11 | Nano Banana | image | `nano_banana` | aspect_ratio 10 values; image refs 0..8 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 12 | Nano Banana Pro | image | `nano_banana_2` (skills also `nano_banana_pro`; `nano_banana_2` is an alias) | aspect_ratio 10 values; resolution `1k/2k/4k` (def `2k`); image refs 0..14 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 13 | Nano Banana 2 Lite | image | `nano_banana_2_lite` | aspect_ratio 11 values incl. `auto`; resolution `1k` only; thinking `MINIMAL/HIGH` (def `HIGH`); image refs 0..14 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 14 | Nano Banana 2 | image | `nano_banana_flash` | aspect_ratio 10 values; resolution `1k/2k/4k` (def `1k`); image refs repeated | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 15 | OpenAI Hazel | image | `openai_hazel` | aspect_ratio `1:1/3:2/2:3/auto`; quality `low/medium/high` (def `medium`); image refs 0..16 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 16 | Outpaint | image | `outpaint` | aspect_ratio 11 values (def `21:9`); exactly 1 image ref | M | Unverified – REST path needed from docs.higgsfield.ai |
| 17 | Seedream 4.5 | image | `seedream_v4_5` | aspect_ratio 8 values; quality `basic/high`; image refs 0..14 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 18 | Seedream 5.0 Lite | image | `seedream_v5_lite` | aspect_ratio 5 values; quality `basic/high`; image refs repeated | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 19 | Seedream 5.0 Pro | image | `seedream_v5_pro` | image refs ≤10; resolution `1k/1.5k/2k` | S | Unverified – REST path needed from docs.higgsfield.ai |
| 20 | Seedream 5.0 Flash | image | `seedream_5_0_flash` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 21 | Soul Cast | image | `soul_cast` | aspect_ratio `16:9` (required); budget int (def 50); prompt optional; no media | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 22 | Soul Cinema Studio | image | `soul_cinema_studio` | style_id, enhance_prompt; Soul aspects + `21:9`; quality `1.5k/2k` | S | Unverified – REST path needed from docs.higgsfield.ai |
| 23 | Soul Location | image | `soul_location` | aspect_ratio 9 values incl. `9:21`; prompt-only | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 24 | Z Image (may be the same as template `z-image-turbo`; unconfirmed) | image | `z_image` | aspect_ratio 5 values; prompt-only | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 25 | Virality Predictor (video analysis, outputs a text report) | video (analysis) | `brain_activity` | video ×1 required; no prompt | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 26 | Cinematic Studio 3.0 | video | `cinematic_studio_3_0` | aspect 7 incl. `auto`; duration int (def 5); resolution `480p/720p/1080p/4k`; genre; speedramp; multi_shots; generate_audio (def false); start/end image, image/video/audio refs (≤15 total) | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 27 | Cinematic Studio Video | video | `cinematic_studio_video` | aspect 5; duration `5/10`; slow_motion; sound (def true); start/end image | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 28 | Cinematic Studio Video 3.5 | video | `cinematic_studio_video_3_5` | duration int (def 15); resolution `480p/720p/1080p`; camera_style / light_scheme / color_grading enums or style_prompt; genre; ≤15 media refs incl. audio 0..15 | M | Unverified – REST path needed from docs.higgsfield.ai |
| 29 | Cinematic Studio Video V2 | video | `cinematic_studio_video_v2` | cfg_scale (def 0.5); mode `pro/std`; sound `on/off`; genre; kling_element_ids; multi_shots; start/end image | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 30 | Cinema Studio 4.0 | video | `cinematic_studio_video_4_0` | modes `t2v/omni_reference/video_edit/video_extension`; up to 1080p; up to 30 images; audio on by default | S | Unverified – REST path needed from docs.higgsfield.ai |
| 31 | Gemini Omni Flash | video | `gemini_omni` | aspect `16:9/9:16`; duration `4/6/8/10` (def 8); resolution `720p`; image refs 0..7 (≤5 with a video); video ref ≤1 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 32 | Gemini Omni Flash 1.1 | video | `gemini_omni_flash_1_1` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 33 | Grok Video (assumed = skills "Grok Imagine (video)") | video | `grok_video` | aspect `16:9/9:16/1:1`; duration int (def 5); start image optional | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 34 | Kling Video Edit | video | `kling_video_edit` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 35 | Marketing Studio Video | video | `marketing_studio_video` | aspect 7; duration int (def 15); resolution `480p/720p/1080p`; generate_audio (def false); mode (def `ugc`); avatars, product_ids, hook_id, setting_id, ad_reference_id, storyboard_id… | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 36 | Minimax Hailuo (variants other than 2.3) | video | `minimax_hailuo` (`--variant minimax/minimax-fast/minimax-2.3-fast`) | duration `6/10`; resolution `512/768/1080`; start/end image (constraints differ per variant) | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 37 | MiniMax H3 Max | video | `minimax_h3_max` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 38 | Seedance 1.5 Pro | video | `seedance1_5` | aspect 7 incl. `auto`; duration `4/8/12`; resolution `480p/720p/1080p`; generate_audio (def true); start/end image | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 39 | Google Veo 3 | video | `veo3` | aspect `16:9/9:16`; start image required; variant `veo-3-preview/veo-3-fast` | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 40 | Google Veo 3.1 | video | `veo3_1` | aspect `16:9/9:16`; duration `4/6/8`; quality `basic/high/ultra`; variant `veo-3-1-preview/veo-3-1-fast`; start image ≤1 | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 41 | Google Veo 3.1 Lite | video | `veo3_1_lite` | aspect `16:9/9:16/auto`; duration `4/6/8` (8 when both frames are set); generate_audio (def false); start/end image | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 42 | Video Background Remover | video | `video_background_remover` | exactly 1 video | M | Unverified – REST path needed from docs.higgsfield.ai |
| 43 | Flux 3 Video Edit | video | `flux_3_video_edit` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 44 | Explainer Video | video | `video_explainer` | prompt ≤5000 chars; medias ≤14 images; duration 20–600 in steps of 10 (required); aspect `16:9/9:16`; preset_id; voice_type + voice_id | M | Unverified – REST path needed from docs.higgsfield.ai |
| 45 | Explainer Video Assembler | video | `explainer_video` | width, height (even ints); items ≥2 video/audio pairs; subtitles font `patrick/caveat/marker/anton` | M | Unverified – REST path needed from docs.higgsfield.ai |
| 46 | 3D Rigging | 3D | `3d_rigging` | model_url (required); enable_animation; animation_action_id; height_meters | M | Unverified – REST path needed from docs.higgsfield.ai |
| 47 | Image to 3D | 3D | `image_to_3d` | image refs (required); should_texture; enable_pbr; enable_rigging; pose_mode; topology; target_polycount… | M | Unverified – REST path needed from docs.higgsfield.ai |
| 48 | Multi-Image to 3D | 3D | `multi_image_to_3d` | 1–4 image refs (required); same options as image_to_3d | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 49 | 3D Objects | 3D | `sam_3_3d` | image refs (required); detection_threshold; export_textured_glb (def true); prompt; seed | M | Unverified – REST path needed from docs.higgsfield.ai |
| 50 | Text to 3D | 3D | `tripo_3d` | prompt (required); geometry_quality / texture_quality `standard/detailed`; pbr; texture; face_limit; negative_prompt | M | Unverified – REST path needed from docs.higgsfield.ai |
| 51 | Inworld Text to Speech | audio | `inworld_text_to_speech` | prompt; voice (required; 113 built-in voices) | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 52 | Mirelo Text to Audio | audio | `mirelo_text_to_audio` | prompt; duration (both required); no media | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 53 | Seed Audio 1.0 | audio | `seed_audio` | prompt (required); format `wav/mp3/pcm/ogg_opus` (def `wav`); sample_rate `8000…48000` (def 24000); speech/pitch/loudness rate; voice_id + voice_type; audio refs 0..2 OR image refs | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 54 | Sonilo Music | audio | `sonilo_music` | prompt; duration (both required); no media | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 55 | Text to Speech | audio | `text2speech_v2` | prompt; variant `elevenlabs/minimax/seed_speech/vibe_voice/cozy_voice`; voice_id; voice_type (all required); char limit 5000–15000 depending on engine | M, S | Unverified – REST path needed from docs.higgsfield.ai |
| 56 | Qwen Audio TTS | audio | `qwen_audio_tts` | not profiled locally | S | Unverified – REST path needed from docs.higgsfield.ai |
| 57 | Speech to Text (transcription) | audio (input) | `speech2text` | not documented locally (`higgsfield model get`) | M | Unverified – REST path needed from docs.higgsfield.ai |
| 58 | ByteDance Image Upscale | image (by name) | `bytedance_image_upscale` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 59 | ByteDance Video Upscale | video (by name) | `bytedance_video_upscale` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 60 | Topaz Image | image (by name) | `topaz_image` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 61 | Topaz Video | video (by name) | `topaz_video` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 62 | Video Upscale | video (by name) | `video_upscale` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 63 | Video Deflicker | video (by name) | `video_deflicker` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 64 | Color Grading LUT | unclear | `color_grading_lut` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 65 | SAM 3 Video | video (by name) | `sam_3_video` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 66 | Autosprite | unclear | `autosprite` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 67 | Clipify | video (by name) | `clipify` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |
| 68 | LLM Text | text | `llm_text` | not documented locally | M | Unverified – REST path needed from docs.higgsfield.ai |

Totals: **68 rows**: 24 image, 21 video incl. analysis and explainer, 5 3D, 7 audio (6 generation + `speech2text`), 11 utility/other. Audio models found: `inworld_text_to_speech`, `mirelo_text_to_audio`, `seed_audio`, `sonilo_music`, `text2speech_v2`, `qwen_audio_tts`, plus `speech2text` (audio input). Skills also describe `draw_to_video` and `reframe` as **workflows**, not models, so they are not listed.

---

## 4. Picker metadata draft

The wording below is our own. Where the skills docs say nothing about a model, the row describes only what the template code supports and is marked *(no local guidance)*. Badge legend: NEW / TOP / FAST / 4K / AUDIO. Badges marked "tentative" rest on version numbers or names rather than a documented claim.

| id | description | bestFor | suggested badges (reason) |
|---|---|---|---|
| `soul-2` | Higgsfield's in-house still-image model, tuned for people and styled portraits. | Editorial, lifestyle and fashion-style images of people; new characters. | TOP (the skills list it as the automatic pick for new people and editorial stills) |
| `soul-cinema` | Soul variant with a filmic look and dramatic lighting. | Movie-still frames and moody concept imagery. | — |
| `seedance-2.5` | General-purpose video model with text, start/end-frame and multi-reference (image/video/audio) inputs, 4–30 s. | Most video briefs: motion-heavy scenes, multi-shot work, image-to-video. | TOP (the skills name it the default video model); NEW (newest Seedance in the template; tentative); AUDIO (generateAudio defaults on) |
| `seedance-2.5-edit` | Changes an existing clip based on a prompt, with optional references. | Restyling or altering a video you already have. | AUDIO (generateAudio setting) |
| `seedance-2.5-extend` | Continues an existing clip for 4–30 s more. | Making a clip longer while keeping the same scene. | AUDIO (generateAudio setting) |
| `seedance-2` | Earlier Seedance with the same input modes, plus 1080p and 4K output. | Briefs that need 4K video. | 4K (resolution enum includes `4k`); AUDIO (generateAudio defaults on) |
| `seedance-2-fast` | Faster Seedance 2.0 tier, capped at 720p. | Quick drafts and iterations. | FAST (named fast tier); AUDIO |
| `seedance-2-mini` | Lightweight Seedance 2.0 tier, capped at 720p. | Lower-cost runs with reference inputs. | AUDIO |
| `kling-3-turbo` | Quick Kling 3.0 tier for text-to-video or animating one start frame, 3–15 s. | Simple motion when speed or cost matters. | FAST (the skills describe it as the fast Kling option) |
| `kling-3-std` | Kling 3.0 with start/end frames, sound, multi-shot and guidance controls. | Simple scenes with frame-to-frame transitions; lower-cost option. | AUDIO (sound setting, on by default) |
| `kling-3-pro` | Higher tier of Kling 3.0 with the same controls. | The same use cases as Standard, at higher quality. | AUDIO (sound setting) |
| `kling-3-4k` | Kling 3.0 at 4K output. | 4K output from the Kling family. | 4K (4k path); AUDIO (sound setting) |
| `kling-3-motion-std` | Moves a character from an image using the motion from a reference video. | Copying a movement or dance onto your own character. | — |
| `kling-3-motion-pro` | Higher tier of Kling motion control. | The same as above, at higher quality. | — |
| `flux-2` | Flux image model known for following prompts closely. | An alternative look when other image models feel generic. | — |
| `grok-imagine-2` | xAI image model with a bold, high-contrast style. | Stylized, anime-leaning or experimental images. | NEW (tentative: version 2.0; listed as a newer id in the skills) |
| `ideogram-4` | Ideogram image model (text-to-image with up to 8 references). | *(no local guidance)* | — |
| `recraft-4.1` | Graphic-design-oriented image model. | Logos, icons, flat illustration, brand marks. | — |
| `qwen-image-3` | Qwen text-to-image model (up to 8 references in the template). | *(no local guidance)* | — |
| `z-image-turbo` | Speed-focused image model. | Fast, cheap drafts and iteration. | FAST (name; the skills call Z Image the fastest in the catalog, though that may be a different version) |
| `wan-3` | Wan 3.0 text- and image-to-video. | *(no local guidance; unprofiled in the skills)* | NEW (tentative: highest Wan version) |
| `wan-3-prime` | Higher tier of Wan 3.0. | *(no local guidance)* | NEW (tentative) |
| `wan-2.7` | Wan 2.7 text- and image-to-video. | Character-consistent clips (per the skills; their audio sync is not exposed in the template). | — |
| `wan-2.6` | Wan 2.6 text- and image-to-video. | Low-cost, deliberately artistic or experimental clips. | — |
| `flux-3` | Flux video model (text- and image-to-video). | *(no local guidance)* | — |
| `minimax-h3` | MiniMax H3 text- and image-to-video. | *(no local guidance)* | — |
| `minimax-hailuo-2.3` | MiniMax Hailuo text- and image-to-video. | Budget motion with believable physics. | — |
| `happy-horse-1` | Happy Horse 1.0 text- and image-to-video. | *(no local guidance)* | — |
| `happy-horse-1.1` | Happy Horse 1.1 text- and image-to-video. | *(no local guidance)* | NEW (tentative: newer than 1.0) |
| `kling-2.6` | Earlier Kling release, text- and image-to-video. | Cinematic motion with physical realism. | — |
| `kling-2.5` | Kling 2.5 Turbo, image-to-video only. | Animating one start frame. | FAST (tentative: path names a `turbo` tier) |
| `kling-o3` | Kling O3 transition between a first and a last frame. | Morphs and transitions between two images. *(no local guidance)* | — |
| `kling-o1` | Kling O1 (Omni) first-to-last-frame video. | The same as above. *(no local guidance)* | — |
| `ltx-2.5-fast` | LTX 2.5 fast tier, text-to-video. | Quick drafts. *(no local guidance)* | FAST (named fast tier) |
| `ltx-2.5-pro` | LTX 2.5 pro tier, text-to-video. | *(no local guidance)* | — |
| `grok-imagine-video-1.5` | xAI video model driven by image and video references. | Stylized, high-contrast motion from references. | — |
| `pixverse-6` | PixVerse 6 text- and image-to-video. | *(no local guidance)* | — |
| `dop` | Higgsfield DoP, image-to-video (lite tier). | Animating one still image. *(no local guidance)* | — |

---

## 5. Open questions

**Host and endpoints**

1. **Host.** No local file mentions `platform.higgsfield.ai`. The template uses `HF_API_BASE_URL=https://api.higgsfield.ai` (`README.md`, `registry.json` docs, `.env` description), and both SDKs default to `https://api.higgsfield.ai` (`higgsfield-js/src/config.ts`, `higgsfield-client/.../http/client.py`). The "platform" name appears only in code (`createPlatformClient`, "Higgsfield platform API"). Confirm in the docs which host serves REST model paths and whether a `platform.` host exists at all.
2. **Key consoles disagree.** The template points users to `https://open.higgsfield.ai/api-keys`. The Python SDK README points to `https://cloud.higgsfield.ai`. Do they issue the same key type? What `Authorization` format does each need (`generation/credentials.ts`)?
3. **Endpoint shape is template-only.** `POST /{model-path}`, `GET /requests/{id}/status`, `POST /requests/{id}/cancel` and `POST /files/generate-upload-url` are all taken from the template. The status mapper reads only `images[].url` and `video.url`, so audio and 3D outputs would need a different response shape (unknown).

**Template paths and mapping**

4. **Derived image-to-video paths.** Eleven entries get their `/image-to-video` path from `t2v()` string replacement, not a literal path (wan ×4, flux-3, minimax ×2, happy-horse ×2, kling-2.6, pixverse-6). Check each one against the docs.
5. **LTX start frame is dropped.** `ltx-2.5-fast`/`-pro` declare `start: 1`, but their path ends in `/text-to-video/fast` or `/pro`, so `t2v()` returns text only and `mapByPaths` never sends the start image. Either an image path is missing or the role should be removed.
6. **First-last-only models.** `kling-o1`/`kling-o3` only have `firstLast` paths. A prompt-only run falls back to the first-last path with no frames. Is a text-only call valid there?
7. **Image-only models.** `kling-2.5` and `dop` only have `image` paths. A prompt-only run posts to the image-to-video path without `image_url`.
8. **Shared defaults are not per-model facts.** 24 of 38 entries use `imageModel()`/`videoModel()` defaults (IMG-DEF/VID-DEF) unchanged, so their enums may not match the real models:
   - flux-2 and recraft-4.1 offer `4k`, but the CLI lists `1k/2k`;
   - recraft-4.1 and z-image accept 8 references, but the skills say Recraft V4.1 and Z Image are prompt-only;
   - kling-2.6: CLI duration is `5/10` vs the template's 4–10; the CLI has a `sound` flag the template lacks;
   - minimax-hailuo-2.3: CLI resolution is `512/768/1080` and duration `6/10`, vs `720p/1080p` and 4–10 in the template;
   - wan-2.6: CLI uses `--quality 720p/1080p` and duration `5/10/15`; the template uses `resolution` and 4–10;
   - wan-2.7: CLI has end-image and audio refs; the template has start only;
   - grok-imagine-video-1.5: the template is reference-to-video (8 images + 3 videos). The CLI `grok_video_v15` *requires* a start image with `480p/720p`. The skills say 2–15 s and `480p/720p/1080p`. Three sources, three answers.
9. **End-frame field names differ by mapper.** Seedance uses `end_image_url`; Kling 3 and the generic image path use `last_image_url`; first-last paths use `first_frame_url`/`last_frame_url`. Confirm each against the docs.

**CLI vs template parameter differences** (CLI flag → template/REST key)

10. Soul: CLI `--quality 1.5k/2k` → template `resolution 720p/1080p` (the skills say the backend maps 1.5k/2k to 720p/1080p). CLI `--soul-id` and single image ref have no template counterpart (template roles `{}`). The skills' `style_id` is also missing. CLI `batch_size` is an integer; the template uses enum `"1"/"4"`.
11. Kling 3.0: CLI `--mode std/pro/4k` → separate REST paths `.../std`, `.../pro`, `.../4k`. The template sends `cfg_scale` and `multi_shots`, which the CLI `kling3_0` does not list (they appear on `cinematic_studio_video_v2`). `sound` is `"on"/"off"` in both. Motion control sends `keep_original_sound: "yes"/"no"` and `character_orientation`, with no CLI counterpart.
12. Seedance 2.0: CLI `--mode fast` → REST path `/fast`. The CLI has `bitrate_mode` (default `standard`) and `genre`, but the template has `bitrate_mode` only on 2.5 (default `high`) and no `genre`. The CLI aspect list includes `auto`; the template's `SEEDANCE_ASPECT` does not. The CLI caps references at 12 in total, including frames; the template enforces per-role caps only.
13. Seedance 2.5: the template allows resolution `480p/720p` only, while the skills say "up to 1080p". `seedance_2_5` appears in the skills but **not in `cli/MODELS.md`**.
14. `generate_audio` on Seedance 2.0 is contradictory. `MODELS.md` lists `--generate_audio` (default true), and `model-catalog.md` says native audio is on by default. But `media-inputs.md` says "Do NOT pass `--generate-audio` to `seedance_2_0`". The template sends `generate_audio`.
15. Flux 2: CLI `--variant pro/flex/max` vs the template's single path `flux-2-pro`. Are there REST paths for flex and max?
16. Media flags: CLI `--start-image/--end-image/--image-references/--video-references/--audio-references` (UUID or path) vs REST JSON `image_url`, `image_urls`, `video_url(s)`, `audio_urls` with public HTTPS URLs from the upload flow. The CLI accepts job/upload UUIDs, but it is unknown whether REST does.

**Naming and inventory**

17. Version ambiguity: `z_image` vs `z-image-turbo`; `grok_image` and `grok_image_2_0` vs `grok-imagine-2`; `happy_horse_video` vs Happy Horse 1.0/1.1; `soul_cinematic` ("Soul Cinematic") vs template "Soul Cinema", with a separate `soul_cinema_studio` in the skills.
18. `cli/MODELS.md` says "Image (23)" but lists 24 image models. Video (22), 3D (5) and Audio (5) match.
19. Some ids appear only in the skills (`seedance_2_5`, `nano_banana_pro`, `seedream_v5_pro`, `soul_cinema_studio`, `cinematic_studio_video_4_0`, `qwen_audio_tts`, and others). The skills note that the Cinema Studio ids do not appear in `higgsfield model list`.
20. The SDK READMEs use example REST-style paths `bytedance/seedream/v4/text-to-image` (`higgsfield-client/README.md`) and `flux-pro/kontext/max/text-to-image` (`higgsfield-js/README.md`). These are examples, not template-verified, and Seedream v4 is not the CLI's 4.5/5.0. They are leads to check in the docs, not confirmed paths.
21. Several template models have no local description at all: ideogram-4, qwen-image-3, ltx-2.5-*, pixverse-6, dop, kling-o1/o3, kling-2.5, flux-3, minimax-h3, happy-horse. Their picker copy needs a source.
