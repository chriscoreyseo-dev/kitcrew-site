# Decisions log

Append-only. Each entry has the date, the decision, the reason, and its status.

## 2026-10-15 — Phase 0

### D-001 Brand values
Set by operator (Chris), 2026-10-15:
- `BRAND_NAME` = **Hive Studio**
- `APP_SLUG` = `hive-studio`
- `CREDIT_MARKUP` = **1.5** (50% markup over the Higgsfield API cost)

Proposed by KitFire and still to be confirmed. Each email address needs its domain verified in Resend before Phase 2.
- `PRODUCTION_URL` = `https://studio.kitcrew.ai`
- `EMAIL_FROM` = `"Hive Studio <login@kitcrew.ai>"`
- `SUPPORT_EMAIL` = `support@kitcrew.ai`

Margin note: with 1.5x markup, Stripe's fees (about 2.9% + $0.30 per charge) come out of the 0.5x margin. Small top-up packs lose the most to the fixed $0.30 fee, so set the minimum pack size at the Phase 5 pricing checkpoint with that in mind.

### D-002 Color scheme: Markethive palette instead of lime
Operator asked (2026-10-15) for Markethive's color scheme in place of Higgsfield's lime `#d1fe17`.
- The Markethive hex values are **not known yet**: markethive.com can't be reached from the build container, and a web search found nothing. Nothing has been made up. Status: waiting on hex codes or a screenshot from the operator.
- How it will be done (from the template source): Quanta defines a raw scale `--hf-color-lime-500` plus `--hf-color-lime-alpha-{05..100}` in `styles/quanta/primitives/color.css`. Semantic tokens in `styles/quanta/theme/color.css` point at it: `brand-primary`, `button-brand`, `border-focus`, `icon-accent`, `icon-brand`, `text-brand`, `text-link`, `transparent-lime-*`. `styles/theme.css` maps `--primary` to `--hf-color-brand-primary`.
- Plan: add a `--brand-500` scale and its alpha steps to primitives, repoint every semantic token that currently uses `lime-*` to it, and leave component code alone. Also check `--hf-color-button-label-brand` (currently dark grey `grey-550` on lime) for WCAG AA contrast against the new brand color, and switch the label to white if the new primary is dark.
- `HERO_GLOW` in `layouts/studio.tsx` is a neutral grey gradient. It can pick up a tint of the brand color.
- Kept from the original spec: dark UI only, and the brand color reserved for the Generate CTA and active states.

### D-003 Build location
Operator decision (2026-10-15): the app lives in `kitcrew-site/hive-studio/`, built on branch `claude/hive-studio`.
Consequences to manage:
- `kitcrew-site` is served by GitHub Pages (`CNAME` = kitcrew.ai, `.nojekyll`). Once merged to `main`, **everything committed under `hive-studio/` is publicly downloadable** at `kitcrew.ai/hive-studio/...`, including source and docs. Never commit secrets (`.env*` is ignored). Before merging, decide whether to move to its own repo or accept that the source is public.
- The app deploys to Vercel with Root Directory = `hive-studio`, separate from the Pages site.
- `_reference/` (the cloned Higgsfield repos) is gitignored and never committed, especially because `app-templates` has no license.

### D-004 Network: docs.higgsfield.ai, higgsfield.ai, api.higgsfield.ai are blocked
These hosts can't be reached from the container: curl gets a proxy 403, and WebFetch fails with ENOTFOUND. GitHub clones work.
Effect:
- The rule "live docs win" can't be applied yet. Everything in `model-catalog.md` comes from the template, the CLI and the skills repos only.
- `ui-inventory.md` can't be written from the live site. No screenshots exist.
- Fix: the operator adds `docs.higgsfield.ai`, `higgsfield.ai` and `api.higgsfield.ai` to the environment's allowed domains, or switches to broader network access.
Status: waiting on operator.

### D-005 License status
- `higgsfield-ai/app-templates`: still **no LICENSE file** as of the 2026-10-15 clone (HEAD `1e15e22`). Keep the template's attribution comments and check again before launch.
- `higgsfield-ai/higgsfield-js`: `package.json` says `"license": "MIT"`, but the repo has no LICENSE file (only THIRD-PARTY-NOTICES.txt).
- `higgsfield-ai/cli`: has a LICENSE file.

### D-006 API host
- The SDK (`higgsfield-js/src/config.ts`) defaults `baseURL` to `https://api.higgsfield.ai`.
- The template reads `HF_API_BASE_URL` from env and has no default in code.
- **Correction to the spec:** the spec says the template uses `platform.higgsfield.ai`. No file in any of the five reference repos mentions that host; they all use `api.higgsfield.ai`. The key-management URLs differ too: `open.higgsfield.ai` (template) and `cloud.higgsfield.ai` (Python SDK). The live docs should say which is current.
- Decision: default to `https://api.higgsfield.ai`. Re-confirm against the docs once they can be reached.

### D-007 Webhook authenticity
- The v2 SDK's `subscribe()` accepts `webhook: { url, secret }`, but it only appends `?hf_webhook=<url>` and **never sends the secret** (`src/v2/client.ts:268-273`).
- The v1 job-set client sends `webhook: { url, secret }` in the body. The doc comment on its `webhook()` helper (`src/helpers.ts:177`) says the secret goes out as the `X-Webhook-Secret-Key` header. That is the different job-set API.
- Decision: v2 REST webhooks count as unsigned. Use the HMAC query token (`gid` + `t`) with a constant-time compare, and always re-fetch `/requests/{id}/status`. Also accept and verify `X-Webhook-Secret-Key` if it ever shows up.

### D-008 API client: keep the template's thin fetch client
`generation/platform.ts` already does auth, upload tickets and error mapping. Move it to `lib/higgsfield/` behind `server-only` and add retries with backoff plus jitter for 429 and 5xx, modeled on the SDK's `retryWithBackoff` (1s base, 60s cap).
Reason: one less dependency. The v2 SDK also types its inputs as `any`, which breaks the strict-TS rule.

### D-009 Template is at the repo root
The registry item is `higgsfield-ai/app-templates/studio`, but the source sits at the repo root (`app/`, `generation/`, `components/studio/`), not under `studio/`.
The pinned versions are Next `16.3.8` and React `19.2.8`.

### D-010 Model catalog findings (see `model-catalog.md`)
- **38 template entries** (8 image, 30 video) across 28 files. **68 more models** appear in the CLI or skills with no REST path known; they are marked Unverified and stay out of the picker until the docs confirm them. That includes all 7 audio models, so **the audio surface can't ship until the docs can be reached**.
- 24 of the 38 entries use the template's **shared default settings** instead of model-specific ones, and several contradict the CLI: Hailuo durations and resolutions, Kling 2.6 durations, Wan 2.6 `quality` vs `resolution`, 4k on Flux 2 and Recraft. Decision: in Phase 4, fix the settings per model from the live docs and log each change here.
- **Template mapping bugs to fix in Phase 4.** Confirmed: LTX 2.5's path ends in `/fast`, so `t2v()` never builds an image path, yet the model declares a `start` slot, so an attached frame is silently dropped. Reported and not yet checked: Kling O1/O3, Kling 2.5 and DoP send prompt-only runs to frame or image paths. Each fix gets a snapshot test.
- End frames go under three different field names in the template (`end_image_url`, `last_image_url`, `last_frame_url`). These may be correct per model; check each against the docs.
