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

## 2026-10-15 — Phase 1

### D-011 Scaffold copied from the cloned template, not `shadcn init`
`ui.shadcn.com` is blocked from the build container, so the template source was copied from `_reference/app-templates` (HEAD `1e15e22`). That is the same code the `higgsfield-ai/app-templates/studio` registry item installs. The untouched copy is committed as its own baseline commit so every later change shows as a reviewable diff.
- `.npmrc` pointed at Higgsfield's private mirror (`socket-firewall.higgsfield.xyz`, 403). Switched to `registry.npmjs.org`. The lockfile stores integrity hashes only, so the pinned versions are unchanged.
- Removed the root `registry.json` and the `registry:build` script (used to publish the template; we don't). `prebuild` now runs `pnpm models` only.

### D-012 BYOK and device cookie removed
Deleted: `generation/credentials.ts`, `generation/device.ts`, `proxy.ts`, `components/studio/key-dialog.tsx`, the sidebar's key status row, and the `save/clear/hasPlatformCredentials` actions.
- The platform client moved to `lib/higgsfield/platform.ts` (`server-only`). `lib/higgsfield/index.ts#platform()` builds it from `HF_CREDENTIALS` + `HF_API_BASE_URL`. Client-safe types live in `lib/higgsfield/types.ts`.
- Phase 2 brings back `proxy.ts` for redirects only.

### D-013 Interim sign-in guard
`lib/auth-guard.ts#requireUser()` is called by submit, status, cancel and upload. It allows access in development and **refuses in production**, so a deploy made before Phase 2 can't spend the platform key for anonymous visitors. Phase 2 replaces its body with `auth()`.

### D-014 Browser history and projects kept until Phase 3 (deviation)
The spec lists removing IndexedDB under Phase 1. The Mongo replacement needs a `userId` (Phase 2) and the DB-backed status route (Phase 3), so `lib/studio/history.ts`, `projects.ts` and `uploads.ts` stay as they are for now, behind the unchanged `useRuns` interface. They're replaced in Phase 3, when generations persist in Mongo.

### D-015 Env validation
`lib/env.ts` (zod) is called from `instrumentation.ts` at server start.
- A malformed value always fails.
- A missing feature group fails in production and is only listed as a warning in development, so the studio boots while integrations arrive phase by phase.
- Blank values copied from `.env.example` count as unset.
- Features read their group through `requireEnv(group)`, which names exactly what's missing.

### D-016 Mongo, indexes, tests
- `lib/db/mongo.ts`: one lazy client, cached on `globalThis` and shared with the Auth.js adapter later.
- `lib/db/indexes.ts` lists every §6 index with explicit names, plus TTL indexes for sessions, verification tokens and rate limits. `pnpm db:init` applies them idempotently.
- **db-init has not been run against a real MongoDB.** The MongoDB binary host is blocked from the container, so it's tested only against a stub. First real run: once `MONGODB_URI` is set.
- Tests use vitest (`pnpm test`).
- `postbuild` runs `scripts/check-bundle-secrets.mjs`. It scans `.next/static` for the literal values of server secrets and for known key prefixes. Verified by planting a fake leak, which failed the check as expected.

### D-017 Server action errors (to fix in Phase 3)
Errors thrown from server actions show their message in the dock in development. In production, Next replaces them with a generic message. Phase 3 changes the actions to return typed `{ ok, error }` results with plain-language messages.

## 2026-10-15 — Phase 2

### D-018 Auth stack versions
- `next-auth@5.0.0-beta.32`, pinned exactly. v5 is still tagged beta on npm, and its peer range includes Next 16.
- `@auth/mongodb-adapter@3.11.3` requires the `mongodb` v6 driver, so the driver moved from 7.7 to **6.21**.
- `@react-email/components` is deprecated on npm ("no longer supported"). It was replaced by `react-email@6` for components and `@react-email/render` for rendering.
- authjs.dev is blocked from the container, so the integration follows the installed package source and types.

### D-019 Auth config
- Built per request (`NextAuth(() => config)`), so builds and keyless dev boots don't need auth env.
- Database sessions (30 days). The session exposes only `id` and `role`.
- Adapter collection names match §6 (`verification_tokens` is the adapter default). Sessions and verification tokens get TTL indexes.
- Magic links expire after **30 minutes**, down from Auth.js's default of 24 hours.
- `events.createUser` sets `role: "user"`, `createdAt` and zeroed credit buckets, and grants `SIGNUP_BONUS_CREDITS` through the ledger (`grantCredits`, refId = user id, so the grant is idempotent). The Stripe customer is still created lazily at first checkout.
- `trustHost: true` (needed behind Vercel and other proxies).

### D-020 Magic-link abuse controls
- Limits: 3 emails per address per 15 minutes, and 10 per IP per hour.
- They're enforced inside `sendVerificationRequest`, so a direct POST to `/api/auth/signin/resend` is limited too, not just the form.
- Counters live in fixed windows in Mongo `rate_limits`, with a TTL index.
- A small built-in list of disposable-email domains is refused. It isn't exhaustive by design.
- The form action maps the wrapped Auth.js errors to plain messages.

### D-021 Keeping dock state through sign-in
When a signed-out user hits Generate or Upload:
1. The sign-in modal opens.
2. The prompt, references and model are saved to `localStorage` (`hive.dockDraft.v1`, 1-hour expiry). It isn't `sessionStorage` because the magic link usually opens a new tab.
3. After sign-in the dock is restored once and the draft is cleared.

**Nothing auto-submits.** Spending credits always takes an explicit click after signing in. The spec's "continue the action" is read as "continue where you left off".

### D-022 proxy.ts and the real gate
- `proxy.ts` redirects signed-out visitors away from `/assets`, `/account` and `/admin`. It checks only that the session cookie exists.
- Real checks happen in each page and handler (`currentUser()`, `requireUser()`). Verified: a forged session cookie passes `proxy.ts` but `/account` still redirects to `/login`.
- `currentUser()` returns null rather than throwing when auth env is missing, so public pages render while integrations are pending.

### D-023 Phase 2 checkpoint status
Verified:
- Unit tests: 20 total.
- Typecheck, lint and build pass. The secret scan passes with fake secrets present at build time.
- Browser checks: the signed-out modal opens on Generate; the draft is saved; disposable-email and unconfigured-auth errors show; `/account` and `/assets` redirect; error page copy is correct.

**Not verified (needs operator):** a real magic link arriving and signing in, sign-out after a real session, the sign-up bonus grant against Atlas, and the draft restore after a real sign-in. These need `MONGODB_URI`, `AUTH_SECRET`, `AUTH_RESEND_KEY` and a Resend-verified `EMAIL_FROM` domain.

## 2026-10-15 — Phase 3

### D-024 Generation lifecycle
`lib/generations/lifecycle.ts`: submit → `pending_submit` → platform → `queued`.
- **Definite 4xx:** the run fails and is refunded.
- **Unclear outcome** (timeout, ambiguous 5xx): the run stays `pending_submit`. After 2 minutes the reconciler fails and refunds it. The platform has no lookup by our id, so we can't prove whether a job exists; the user is never left charged for nothing. Cost to us: Higgsfield may have run and billed a job we refunded. It's rare and logged.
- **Double submits:** a client UUID `clientRequestId` with a unique `{userId, clientRequestId}` index means a double click creates one run and one platform job. The REST API documents no idempotency key.
- **Finalize** takes a 90-second lease (`finalizingUntil`) before fetching status. Concurrent webhook, cron and cancel paths never settle or copy twice. Every terminal transition is a conditional update, and **only the caller that made the transition refunds**. Tests cover the cancel-versus-webhook race; with the guard removed, a refund is paid twice.
- **15-minute cap:** a still-queued run is canceled on the platform first, then failed and refunded.
- **Concurrency:** a temporary cap of `MAX_IN_FLIGHT = 4` per user. Phase 5 replaces it with the per-plan limit inside the debit transaction.
- **Costs and refunds:** all runs cost 0 until Phase 5. `refundGeneration` is the hook Phase 5 implements through the ledger.

### D-025 Retries on submit
The spec says to retry 429 and 5xx. Submit retries **only 429, 503, and connection-refused/DNS failures**. A 500, 502, 504 or timeout may mean the job was created, and retrying would double-create (and double-bill) it; those go to the reconciler instead. Status, cancel and upload calls retry 429, 5xx and network errors. Backoff is full jitter (1s base, 15s cap for submit) and honors `Retry-After`.

### D-026 Status payload shapes (to verify against docs)
- `images[].url` and `video.url` come from the template.
- **`audio.url` is assumed** for audio models, based on the docs not being reachable. Check it in Phase 4 against the audio model pages.
- An unknown status is treated as still running, and the 15-minute cap ends it.

### D-027 Webhook handling
- The URL token (`gid` plus HMAC) is compared in constant time. A bad token gets a 404.
- Events are deduped in `hf_webhook_events {requestId, status}`.
- The response comes back immediately, and `finalizeGeneration` runs in `after()`, because R2 copies of video can exceed the 10-second webhook deadline.
- The body is never trusted: status is always re-fetched from the platform.

### D-028 Reconciler and local dev
- `/api/cron/reconcile` is protected by `Authorization: Bearer $CRON_SECRET` (what Vercel Cron sends). `vercel.json` schedules it every minute. **Per-minute crons need a Vercel Pro plan**; on Hobby the cron runs daily at most, so webhooks must be configured.
- With webhooks on, a run is re-checked if it hasn't been checked for 3 minutes. Without them, the threshold is 8 seconds.
- In development with Mongo and `HF_CREDENTIALS` set and no `HF_WEBHOOK_BASE_URL`, `instrumentation.ts` runs the reconciler every 5 seconds in place of the cron.

### D-029 R2
- Outputs are streamed to `u/{userId}/{generationId}/{n}.{ext}`, with the extension taken from the real content type. Cache headers are `immutable`, with a 2 GB cap.
- Without R2 in development, platform URLs are kept (they expire in about 7 days) and a warning is logged. Production refuses to finalize without R2.
- Image dimensions aren't probed; the feed uses the aspect ratio from settings. Revisit if justified rows look off.
- Deleting a generation removes its R2 objects (best effort, failures logged).

### D-030 Media ownership and uploads
- `/api/upload` checks the declared size against our limits (image 20 MB, video 200 MB, audio 50 MB), applies a 30-per-minute limit per user, and **stores the platform's `public_url` server-side** in `uploads` as `pending`.
- After the PUT, the browser confirms by upload id.
- Submit rejects any media URL that isn't one of the user's ready uploads or completed outputs, so the browser can't make the platform fetch arbitrary URLs.

### D-031 Access before billing
`GENERATION_ACCESS` (default `admins`) limits production generation and uploads to `role: "admin"` users until Phase 5 ships billing. Development is open to any signed-in user. To make an account an admin, set `role: "admin"` on its `users` document.

### D-032 Client
- `useRuns(enabled)` loads the newest 500 runs through a server action and polls the status route every 3.5 seconds while anything is running. Deeper paging comes with `/assets` in Phase 6.
- Projects use client UUIDs, so `create()` stays synchronous for the template's UI. Changes apply optimistically and roll back on error.
- Deleting a project keeps its generations, which move back to All Generations.
- Server actions return typed `{ ok, code, message }` results (resolves D-017).

### D-033 Phase 3 checkpoint status
- 49 unit tests, including lifecycle tests on an in-memory Mongo (`mingo`): idempotent submit, refund exactly once, concurrent finalize, cancel, timeouts, ownership.
- Routes smoke-tested: webhook and cron return 404 without credentials; status and upload return 401 signed out.
- **Not verified (needs operator keys):** a real image and video generation end to end, survival across refresh, serving from R2, and a real cancel. These need `HF_CREDENTIALS`, Atlas, R2, and either `HF_WEBHOOK_BASE_URL` plus a tunnel or the dev poller.
