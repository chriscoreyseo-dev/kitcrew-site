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

## 2026-10-15 — Phase 4 (partial: docs still unreachable)

### D-034 Template mapping fixes
A snapshot test (`tests/mappers.test.ts`) now records the exact request for every model and every input combination it advertises. Fixed from the template's own declarations, without inventing endpoints:
- **`kling-o1`, `kling-o3`** (only a `firstLast` path) and **`kling-2.5`, `dop`** (only an image path) now require a start frame (`requiredRoles: ["start"]`). Before, a prompt-only run went to a frame or image endpoint with no frame and would fail at the platform. Generate is now disabled with "Add a start frame to use …".
- **`ltx-2.5-fast`, `ltx-2.5-pro`**: removed the `start` slot. Their only path is text-to-video, and `t2v()` can't derive an image path from `.../text-to-video/fast`, so attached frames were silently dropped. The slot comes back once an LTX image-to-video path is verified.
- An invariant test now fails if any model accepts a start frame without sending it.

### D-035 Picker metadata
`generation/catalog/metadata.ts` holds provider, description, best-for and badges for all 38 models, written in our own words from `docs/model-catalog.md` §4. Model files stay template-shaped.
- Badges appear only where a setting, path or the skills guidance supports them. A test checks that AUDIO and 4K badges match settings.
- "NEW" badges based on version numbers are left out until confirmed.
- The picker UI that shows them is Phase 6.

### D-036 Audio surface plumbing
- `Surface` now includes `"audio"`. The gallery has an audio tile, the lightbox has an audio player, and the mode rail has an Audio tab.
- The rail shows a surface only when it has at least one model. **No audio model is verified yet** (all 7 are "Unverified – REST path needed"), so the Audio tab stays hidden and none of this audio UI is visible yet.
- Adding an audio model file makes it appear. The response shape `audio.url` is still the assumption from D-026.

### D-037 What Phase 4 could not do (needs docs.higgsfield.ai)
- Add the 68 unverified models: Nano Banana, GPT Image, Seedream, Veo, upscale, background removal, 3D and all audio models.
- Correct the 24 models that use generic default settings, and the CLI-versus-template parameter conflicts (D-010).
- Verify the 11 `t2v()`-derived image-to-video paths.
- Run "at least one real generation per family". That also needs `HF_CREDENTIALS`.

## 2026-10-15 — Phase 5

### D-038 Pricing
- `lib/billing/price.ts#priceFor(rule, settings, config)` is a pure function shared by the Generate button and the server.
- Formula: `credits = ceil(hfUsd × CREDIT_MARKUP / CREDIT_USD_VALUE)`. The product is rounded to 6 decimals before `ceil`, so float noise never adds a credit.
- Rules can charge per run, per image, or per second, with setting multipliers (for example, resolution).
- `model_pricing` documents override a rule or disable a model.
- **The browser never sees the markup or upstream cost.** `pricingAction` sends rules pre-scaled into credit units, and a test proves the client result equals the server's credits across durations and resolutions.

### D-039 Every model is unpriced (TBD)
`lib/billing/pricing-table.ts` has an entry for every model, all `null`. The per-model USD prices live in console.higgsfield.ai, which isn't reachable from here.
- In **production**, an unpriced model is refused ("isn't priced yet").
- In **development**, it runs at 0 credits with a warning.
- To fix: fill the table from the console export, or insert `model_pricing` docs.

### D-040 Credits and ledger
- `insertChargedGeneration` does three things in one transaction: debits subscription credits first, then top-up credits; enforces the per-plan, per-surface parallel limit; and inserts the generation.
- The balance update is conditioned on the exact balance read in the transaction, and it touches the user document on every submit, even at cost 0. Concurrent submits for one user therefore conflict and serialize, so the in-flight count holds.
- A double click's losing transaction rolls back, so it's charged once.
- The debit split is stored as `costSplit`. Refunds return credits to the same buckets, with ledger refIds `{generationId}:{bucket}`, idempotent through the unique `{reason, refType, refId}` index.
- **Subscription credits reset on each paid invoice** (`setTo`, not add) and are spent first. **Top-up credits never expire.** Both behaviors follow the spec's defaults.
- Balances never go below zero; clawbacks are clamped.

### D-041 Plans and top-ups (amounts TBD for the operator)
- `lib/billing/plans.ts` defines Free, Starter, Plus and Ultra (monthly and annual) and three top-up packs.
- Every credit allowance and price is `null`. An option becomes purchasable only once its amounts **and** Stripe price ID are set.
- Parallel limits: Free 1/1/1; Starter 4 image, 2 video, 2 audio; Plus 8/6/4; Ultra 12/8/6.
- `topupBonus` (more credits per dollar on higher plans) is 1 everywhere until set.
- Top-up credits are always computed from server config, never from Checkout metadata (a test passes a forged `credits` value in metadata and it's ignored).

### D-042 Stripe
- **Checkout:** the customer is created lazily, with an idempotency key and only if none is stored yet. The session carries `client_reference_id` and metadata. Success and cancel return to `/account/billing`.
- **Portal:** at `/account/billing`.
- **Webhook** (`/api/webhooks/stripe`, Node runtime): verifies the raw body with `constructEvent`, then inserts `stripe_events {_id: event.id}`; a duplicate gets a 200 and is skipped. If handling fails, the record is removed and the route returns 500 so Stripe retries. Tested with real SDK-signed payloads.
- **Event handling:**
  - Paid `checkout.session.completed` (mode payment) grants the top-up (refId = session id), records `topup_purchases` and sends a "Credits added" email through Resend.
  - `invoice.paid` with `subscription_create` or `subscription_cycle` resets the subscription bucket to the plan allowance and sets `plan` and `planRenewsAt`. An unknown price throws, so Stripe retries until it's configured.
  - `customer.subscription.updated` syncs the plan. `.deleted` (which fires at period end) moves the account to Free and zeroes plan credits.
  - `charge.refunded` claws back top-up credits in proportion to the cumulative amount refunded, and flags the account `refund_review`.
- Subscription and price IDs follow the 2026-09-30 API shapes: `invoice.parent.subscription_details`, `line.pricing.price_details.price`, and the item's `current_period_end`.

### D-043 UI added in Phase 5 (restyled in Phase 6)
- The Generate button shows the credit cost; unpriced models show none.
- The sidebar shows your balance and a "Get more credits" button.
- An upgrade modal opens on `INSUFFICIENT_CREDITS`.
- `/account/billing` shows the balance by bucket, the plan and its renewal date, the portal, purchase options and the last 50 ledger entries.
- Options without final numbers read "Coming soon" instead of showing an inert button.

### D-044 Phase 5 checkpoint status
- 117 tests. Covered: debit and refund idempotency, two simultaneous submits with credits for one (exactly one runs), double-click charged once, refunds to the original buckets, subscription reset idempotency, clawback never below zero, every Stripe event branch, webhook signature/dedupe/retry, and client-versus-server price equality.
- **Not verified (needs operator):** a Stripe **test-mode** subscription and top-up crediting the right buckets end to end. That needs a Stripe test account, products and prices with their IDs in env, `stripe listen` and Atlas.
- `GENERATION_ACCESS` stays `admins` by default until prices are set (D-031).

## 2026-10-15 — Phase 6 (built without access to higgsfield.ai)

### D-045 How the UI was built
higgsfield.ai is still blocked from the container (D-004), so no live screenshots or side-by-side comparisons exist. Pages follow spec §9 and the template's components and tokens. The comparison is still owed: once the site is reachable, capture `docs/screens/` and adjust spacing and typography to match.

### D-046 Routes and global chrome
- **Global chrome:** the site header lives in the root layout on every page. It holds the logo, Explore, Image, Video, Audio, Effects, Community and Pricing, a credit pill, an Upgrade button and the account menu; signed out, it shows Login and Sign up, which open the magic-link modal. On mobile the nav becomes a sheet.
- **Surface tabs** show only when that surface has a verified model, so Audio is hidden and `/audio` returns 404 until an audio model is added.
- **Promo bar:** dismissible, set in `lib/site-config.ts` (off by default).
- **Cookie consent:** Accept all / Reject non-essential / Preferences. There are no analytics yet; anything added later must check `hasAnalyticsConsent()` first.
- **Home page:** `/` is now **Explore**. The template's sidebar-and-dock studio moved to **`/assets`** (library) and **`/projects/[id]`**, with the URL kept in sync as views change.

### D-047 Generator pages
`/image`, `/video` and `/audio` use `layouts/generator.tsx` with `hooks/use-composer.ts`.

**Left panel (400px):**
- **Mode tabs:** shown only when they change the model list. Video has Create, Edit (models with a source slot) and Motion Control. Image has a single mode, so no tabs.
- **Model card:** a category label derived from badges and name, plus a searchable picker grouped by provider, with badges and "from ✦N" or "Price pending".
- **Media slots:** frame and source slots appear only when the model takes them, plus one mixed reference drop zone through `AssetLibraryModal`.
- **Prompt** with a character count, and a **settings row** (headline pill, resolution pill, More → `SettingsDialog`).
- **Generate button:** sticky, showing "Generate ✦ cost". On mobile it's a fixed bottom bar.
- **Cancel:** "Cancel queued (n)" sits next to Generate instead of replacing it. With per-plan parallel runs, Generate stays available while others run, and only queued runs can be canceled.
- **Not built:** "Enhance prompt", because no API capability is verified. Per spec, no inert controls.

**Right canvas:**
- History / How it works switch.
- An empty state with three step cards.
- The feed, filtered to the surface. Tiles gain Reuse prompt & settings, Animate (image → `/video?start=`), and Publish/Unpublish.
- **Upscale** isn't offered: no verified upscale endpoint.

**Link parameters:**
- `?model=` and `?prompt=` (Recreate).
- `?preset=` (Effects: model, prompt template and settings).
- `?start=` (Animate). The server only accepts it on submit if the URL is the user's own media.

### D-048 Community, Effects, Admin (built by subagents within fixed file ownership)
- **Community:**
  - Publish/unpublish is owner-only, and only for completed runs.
  - The public DTO never exposes userId, email, hfRequestId, r2Key or the input media; authors are shown as a masked email.
  - Paging uses a `publishedAt` + `_id` cursor.
  - `/g/[id]` has Recreate and Report. Reports are deduped per reporter (backed by a unique partial index), limited to 10 per hour, and the owner sees Unpublish instead of Report.
- **Effects:**
  - The `presets` collection is seeded with 12 starter presets (`pnpm presets:seed`, idempotent; admin edits and covers survive a re-seed).
  - `/effects` has category chips; `/effects/[slug]` has "Use effect".
  - Covers are empty until Phase 7.
- **Admin** (`role: "admin"` only; everyone else gets a 404):
  - Users: search, credit adjustments through the ledger (`admin_adjust`, with a per-form token for idempotency), and clearing `billingFlag`.
  - Generations: filtered list.
  - Models: enable/disable and pricing-override JSON, validated against `PriceRule`.
  - Presets: full CRUD.
  - Moderation: dismiss, or unpublish and action the reports.
  - Indexes for these lists were added to `lib/db/indexes.ts`.

### D-049 Brand cleanup
- Higgsfield's own models (Soul, DoP) are now labeled by family ("Soul", "DoP"). Their copy no longer says "in-house", which wrongly implied they're ours.
- The Higgsfield logo file (`public/model-icons/higgsfield.svg`) is removed, so those models show a neutral icon.
- An upload error message that named the vendor is reworded.
- Other providers' icons (Kling, Seedance, etc.) stay, as the spec allows.

### D-050 Phase 6 checkpoint status
- **Pages checked** at 1440px and 390px in Chromium: no page errors and no horizontal overflow on `/`, `/video`, `/image`, `/effects`, `/community`, `/pricing`, `/login`, `/legal/terms`, and the redirects for `/account`, `/assets` and `/admin`.
- **Tests and build:** 149 tests; typecheck, lint, format and build pass; the secret scan is clean.
- **Not verified:**
  - The side-by-side comparison with higgsfield.ai (blocked).
  - Signed-in, admin, populated-feed and effects-with-data views (they need Atlas).
  - The final color palette (Markethive hex codes still pending, D-002).

### D-051 Brand art replaces template placeholders
- `pnpm brand:art` (`scripts/brand-art.ts`) writes `public/brand/art-1..4.svg`, `public/brand/mark.svg` and `app/icon.svg` from `BRAND` colors (a hexagon/honeycomb motif). When the Markethive palette lands (D-002), change `lib/brand.ts` and re-run the script.
- These are used for:
  - the header logo and favicon;
  - the studio hero and generator empty-state triptych (`BRAND_TRIPTYCH`);
  - the template picker cards (now derived from `PRESET_SEED`);
  - the effect cover fallback.
- Removed: `public/presets/placeholder-*.svg` and the template `favicon.ico`.
- The hero keeps showing the user's own three latest outputs once they exist.

### D-052 Copy pass
- The studio home tabs are now "Effects / My Projects", so the label no longer clashes with the top-nav "Explore". The default headline is "What will you make today?".
- The no-models screen is user-facing ("Back in a moment") and no longer shows vendor CLI commands.
- The home link "See more" is now "See more from the community" (descriptive link text).
- The legal pages stay explicit placeholders: legal copy is the operator's to supply.

### D-053 Accessibility (Lighthouse 12, dev server, no DB)
- **Fixes:**
  - `--muted-foreground`: raised from `#828282` (4.2:1 on cards) to `#9a9a9a`, which clears AA 4.5:1.
  - The slider's `aria-label` now reaches the thumb's `<input type="range">`.
  - Pricing plan names changed from `h3` to `h2` to fix heading order.
- **Result:** accessibility 100 on mobile and desktop for `/`, `/image`, `/video`, `/pricing`, `/login`, `/effects`, `/community`, `/assets`, `/legal/terms`, and `/account` (which redirects to login). Best practices is 100, except `/community` at 96 (a console error from the missing DB in this sandbox). SEO is 100.
- **Not measured:**
  - `/audio`: 404 until an audio model is installed.
  - `/effects/[slug]`: needs seeded presets in Atlas.
  - Signed-in views.
  - Performance: production boot fails closed without the full env, so it is measured on the Phase 8 preview deploy.

### D-054 Showcase covers
- `pnpm showcase --email <account>` (`scripts/generate-showcase.ts`) generates a cover for each active effect without one, running through the real lifecycle: `submitGeneration` → `finalizeGeneration` polling → copy to R2. It then sets `presets.coverUrl`.
- Options: `--force` regenerates every cover; `--only a,b` picks specific effects.
- **Requirements:**
  - Atlas, `HF_CREDENTIALS` and R2. It refuses to run without R2, because platform URLs expire.
  - An account that has signed in once. Runs are charged to it and appear in its library.
- **How it runs:**
  - Under tsx with `--conditions react-server`, so the `server-only` imports resolve.
  - Effects run one at a time to respect plan parallel limits; each has a 15-minute deadline.
  - `{subject}` is filled from a fixed per-effect subject list in the script.
- Hero media stays as brand art plus the user's own outputs (D-051), so no separate hero generation is needed.
- **Not run here:** no keys in this sandbox. It was verified only to load and to fail fast on missing env.

## 2026-10-15 — Two deployments (S566-DRL-01, S566-DRL-02) and Phase 8

### D-055 One codebase, two deployments: `STUDIO_MODE`
Chris ruled (S566): Hive Studio runs **inside MarketHive** behind a dashboard badge, paid in Hive credits, **and** as a public studio at studio.kitcrew.ai with its own sign-in and Stripe.
- `STUDIO_MODE=standalone|markethive` is read **at runtime** (`lib/mode.ts`), so one Docker image serves either deployment. The browser learns the mode from the root layout (`StudioModeProvider`, `lib/mode-info.ts`; no secrets cross).
- Shared in both: brand, models, generator UI, library, community, effects, admin.
- Differs: sign-in (D-056), wallet and prices (D-057), framing (D-058).
- `checkEnvAtBoot` only demands the groups the mode needs (`groupsFor`): markethive drops `auth` and `stripe`; standalone drops `markethive`.

### D-056 markethive sign-in: signed handoff, our own session
- The MarketHive badge asks MarketHive (logged-in member, CSRF-checked POST) for a fresh token and loads `/auth/markethive?token=…&next=/image` in the overlay iframe.
- Token = `base64url(JSON claims) . base64url(HMAC-SHA256(secret, "hive-studio-handoff.v1." + payload))`. Claims: `v, mid` (MEMBERS.USER_ID), `email, name, admin` (MEMBERS.IS_ADMIN), `iat, exp, nonce`. Refused if older than 120 s, expired, tampered, or its nonce was already spent (`handoff_nonces`, unique `_id`, 24 h TTL).
- A valid token upserts the user by `markethive.memberId` (unique sparse index), sets `role` from `admin` **on every sign-in** (MarketHive stays the source of truth), and opens an opaque studio session: 32 random bytes in cookie `hive_mh_session`, stored as a SHA-256 hash in `mh_sessions` (12 h TTL).
- Cookie: `HttpOnly; Secure; SameSite=None; Partitioned; Path=/`. Partitioned (CHIPS) keeps it working in the third-party iframe without being a cross-site tracker. Verified in Chromium by the E2E dashboard test (studio on `localhost`, dashboard on `127.0.0.1` = cross-site).
- No Auth.js in this mode: `/api/auth/*` and the Stripe webhook answer 404; login pages send members back to MarketHive (`target="_top"`).
- Why not Auth.js database sessions: there is no email step or provider account, and the cookie needs `Partitioned`, which Auth.js's cookie config doesn't expose.

### D-057 markethive wallet: MarketHive is the ledger of record
- Hive credits are MarketHive's `MEMBER_DETAILS.VAULT_BALANCE` (dollars). The studio keeps them as **integer cents** and shows them with two decimals ("Hive credits").
- MarketHive owns the price: `ADMIN_PARAMS` `HIVE_STUDIO_PRICE_IMAGE|VIDEO|AUDIO` (one flat price per generation per surface, **placeholders, staged for Chris**; empty = not priced = refused).
- API: `POST {MARKETHIVE_BASE_URL}/hive_studio_api.php`, JSON `{action, member_id, ref?, surface?, model?}`, headers `x-hive-studio-ts` + `x-hive-studio-sig` = hex HMAC-SHA256(secret, `"hive-studio-wallet.v1\n" + ts + "\n" + body`), ±300 s. Actions: `prices`, `balance`, `debit` (idempotent on `ref`), `refund` (refunds a debited `ref` once; an unknown ref is a no-op).
- Submit in this mode: the insert transaction still enforces the parallel limit (cost 0 in our ledger, `wallet.state = "debiting"`), then MarketHive debits by `ref` = generation id. A definite decline deletes the run (nothing ran, nothing charged). An unclear answer fails the run with `walletRefundPending` and refunds by ref; the reconciler retries undelivered refunds (step 4).
- "Reserve" and "debit" are one step: MarketHive debits at submit and refunds on failure, so there is no separate capture call to lose.
- Refunds go to whichever wallet the **run** records (`doc.wallet`), not the current mode.
- Parallel limits for members: image 4, video 2, audio 2 (Starter's), since members have no studio plan.
- A non-JSON reply is never read as success (dev3 answers 200 with HTML for unknown paths).
- Why flat per-surface: the ruling asked for a per-generation price in ADMIN_PARAMS. Risk for Chris: a 10 s 1080p video costs Higgsfield far more than a 5 s 480p one at the same flat price; a per-second or per-model price is the follow-up if he wants it.

### D-058 Framing and security headers, chosen at runtime
`proxy.ts` now runs on every route (not just the private ones) and sets: CSP `frame-ancestors` (`'none'` standalone; the `MARKETHIVE_FRAME_ANCESTORS` origins in markethive mode, malformed entries dropped), `base-uri 'self'`, `object-src 'none'`, `form-action 'self'`; `X-Frame-Options: DENY` when unframeable; `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`; HSTS when `APP_URL` is https. A full script CSP is not set: Next's inline bootstrap scripts would need nonces on every page (follow-up if wanted).

### D-059 Docker deploy: standalone output, local storage, in-process reconciler
- `next.config.ts` → `output: "standalone"`; `Dockerfile` (node 24 slim, pnpm via corepack, non-root, `/api/health` healthcheck that checks the JSON, not just a 200).
- `STORAGE_DRIVER=local` writes outputs to `LOCAL_STORAGE_DIR` (a volume) and serves them at `/media/u/{user}/{generation}/{n}.{ext}` (exact key shape only, Range support). R2 stays the default and the choice for anything that scales out.
- `INTERNAL_CRON_SECONDS` runs the reconciler in-process (no Vercel Cron on Docker). `DB_INIT_AT_BOOT=1` applies indexes on start.
- `docker-compose.dev3.yml`: studio + `mongo:7.0` as a one-member replica set (transactions need it) + two named volumes. `docker-compose.standalone.yml`: studio.kitcrew.ai on a Docker host with Atlas + R2. `vercel.json` stays for the Vercel option. **studio.kitcrew.ai is not deployed**: the host is Chris's pick (new spend).
- `packageManager: pnpm@12.11.2` pins the image's pnpm. `mingo` (tests only) is pinned to 7.2.4: 7.2.5 was under a day old and pnpm's release-age policy refused the lockfile.

### D-060 Brand: MarketHive hive gold (resolves D-002)
`#D39725` (hive gold) + `#FFFFFF`, from Tom's CLEANED.MH.LOGO group (S562, confirmed S566). Added `--hf-color-hive-500` and `--hf-color-hive-alpha-*` primitives; every semantic token that pointed at lime now points at hive gold. Button labels stay `#1a1a1a` on gold (6.9:1; white on gold would be 2.5:1 and fail AA). `pnpm brand:art` re-run.

### D-061 `BOOT_REQUIRED_GROUPS`
A Docker host gets its keys one at a time. `BOOT_REQUIRED_GROUPS=db,markethive` lets dev3 boot and report what is missing; every feature still refuses at use through `requireEnv`, so nothing runs half-configured. Empty (the default) keeps D-015's strict boot.

### D-062 Phase 8 checkpoint
- **Unit:** 182 tests (33 new): handoff and wallet signatures (including a fixed test vector the PHP side reproduces), the wallet client (cents, declines, HTML-200 guard, price cache), the markethive charge path on the in-memory Mongo (debit once, double click, insufficient, unpriced, platform failure and nsfw refunds, MarketHive down at debit and at refund then reconciler retry, parallel limit), env groups per mode, headers per mode, local storage (path safety, download, http guard).
- **E2E (Playwright, `pnpm build && pnpm e2e`):** 11 tests, both modes, against the production build. `e2e/mocks/server.mjs` mocks Higgsfield, MarketHive (the wallet API with the same HMAC and idempotency rules as the PHP, plus a dashboard page that frames the studio) and Resend, and runs MongoDB as an in-memory replica set. Covered: framed handoff sign-in; frame-ancestors per mode; debit → completed output served from `/media`; failed run refunded once; insufficient credits → "Add credits on MarketHive"; admins-only gate; single-use and forged tokens; no Auth.js or Stripe in markethive mode; magic-link sign-in → spend 15 → failure refund → ledger rows (standalone).
- On Windows the E2E runner uses `next start` (pnpm's symlinks inside `.next/standalone` can't be followed without Developer Mode); Linux and the Docker image run `server.js`.
- `E2E_ALLOW_HTTP_OUTPUTS=1` lets the mock's plain-http localhost outputs through the https-only rule. Test-only; never set on a deployment.
- `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass.
- **Not verified here:** the Docker image build itself (no Docker on this machine; Coolify builds it), Safari's handling of the Partitioned cookie, and anything that needs Chris's keys.

### D-063 /media needs a viewer who may see it (S581 finding)
Found on production 2026-10-18: `curl` of a member's `/media/u/{user}/{generation}/0.jpg` with no cookie returned 200. Both ids are ObjectIds (timestamp + counter), so keys are guessable; "same exposure as R2 public URLs" (D-059) was not acceptable for private runs.
- `app/media/[...key]/route.ts` now serves a file only when `lib/storage/media-access.ts` allows it: the signed-in **owner** or an **admin**; **anyone** for a generation that is published to Community (completed + `isPublic`) or an effect's **cover** (`presets.coverUrl`); or a **signed link** (`?exp=&sig=`, HMAC-SHA256 over key + expiry, 24 h max). Anything else, including a missing file, is the same `404` with `no-store`. Access is checked before the file is stat'ed, so the answer leaks nothing about which files exist.
- Signed links exist for one reason: Higgsfield fetches a member's own output (Animate, references) with no cookie. `submitGeneration` signs every `/media` URL in the platform request body at send time; the run keeps the plain URL, which `assertMediaOwned` matches on. The key is derived from `AUTH_SECRET` or `HF_WEBHOOK_SECRET` under its own label (`hive-studio-media-link.v1`); no new variable to set, and `MARKETHIVE_SHARED_SECRET` is deliberately not used (MarketHive holds it).
- Caching: private media `private, max-age=86400, immutable` (browser only, never a shared cache); public media `public, max-age=300`, so unpublishing takes effect within minutes. `Cross-Origin-Resource-Policy: cross-origin` stays.
- Inside MarketHive's overlay the media requests come from the studio's own document, so the Partitioned `hive_mh_session` cookie is sent; E2E covers it (framed generation decodes; a cookie-less request to the same URL is 404). Downloads fetch same-origin with the cookie. Opening a media URL in a **new top-level tab** from inside the overlay has no partitioned cookie there and now 404s; the studio has no such link for members (only admin pages, which run top-level, and `downloadMedia`'s fallback after a failed fetch).
- Not covered: R2 public URLs (`STORAGE_DRIVER=r2`) are still public by design; production and dev3 use `local`. Signed R2 URLs are the follow-up if R2 ever carries member media.

### D-064 Members share their own generations through MarketHive (S581, Chris)
Chris: members should share their pictures and videos from the Studio gallery "the same way they do from the homepage", with the link tied to their account; and Add credits must reach the Hive Vault or go.
- **Share = an explicit, per-run choice.** The gallery tile's Share action and the detail view's Share icon open `components/studio/share-dialog.tsx`, which POSTs `/api/generations/{id}/share` (owner only, same-origin, `{ index }` for image n of a multi-image run). That sets `sharedAt` on the run (`lib/sharing.ts`, idempotent, first time kept). D-063 media access now treats `sharedAt` like `isPublic`: the run's files are public; every unshared run stays private.
- **The link lives on MarketHive:** `{MARKETHIVE_BASE_URL}/watch/studio/{slug}` (slug = run id, `-n` for output n > 0), with per-network suffixes `/fb /x /li /wa /em` so MarketHive's page_view_tracker counts visits by network, exactly like the Newest Video share. MarketHive's page reads `GET /api/shared/{slug}` (public: kind, file URL, aspect, owner's MarketHive member id, created time - **never the prompt**; anything unshared is the same 404) and renders the picture/video with a JOIN button that makes the sharer the sponsor.
- The panel matches the home page's: link + Copy, Facebook, X, LinkedIn, WhatsApp, Email, Download.
- The old Share (Web Share API / copy of the raw `/media` URL) only remains where no `onShare` is given; since D-063 a raw `/media` link 404s for anyone but the owner.
- **Add credits:** with no `MARKETHIVE_CREDITS_URL` set, markethive mode now defaults to `{MARKETHIVE_BASE_URL}/index_members?wallet-popup-subsection-vault` (`hiveVaultUrl`), MarketHive's own wallet deep link that opens the Hive Vault; all four Add credits links already open in the top window.
- Not done: unsharing (a shared run stays shared), and share counts per member in the Studio (MarketHive counts the visits).

### D-065 Auto-publish switch; Community shows the MarketHive name (S584, Chris)
Chris asked whether a creation can go to Community automatically (it could not: D-048 publishing is a per-run click), then ruled: "add an auto-publish toggle on the generator, off by default, and show the member's MarketHive name on community cards instead of the masked email."
- **Switch:** the generator footer (`components/generator/auto-publish-switch.tsx`, above Generate) holds "Auto-publish to Community". Off by default. Remembered per browser (`generation/stores/auto-publish.ts`, key `hive.auto-publish.v1`, `skipHydration` so the server-rendered "off" never mismatches); a cleared store falls back to off. It applies to runs submitted while it is on, never retroactively. The studio dock (`layouts/studio.tsx`) has no switch and always submits private.
- **Server:** `submitGenerationAction` takes `autoPublish?: boolean`; the run stores `autoPublish: true`. `finalizeGeneration` sets `isPublic` + `publishedAt` in the same update that marks it `completed`, only when there are outputs. Failed, blocked and canceled runs stay private. Unpublish works as before.
- **Author:** `lib/community.ts` `authorLabel` shows `users.markethive.name` (MEMBERS.NAME, the same name `/watch/studio` prints as "Shared by", refreshed on every handoff), trimmed to 60 characters. Members with no MarketHive name (standalone mode) still get `maskAuthor`. The email itself still never leaves the server.
- Tests: 223 (auto-publish on complete, never on nsfw, name with masked fallback).

### D-066 Add to Community from the Share panel (S584, Chris)
Chris: "I want a option in the share option to add to community" - look at an image already made and send it to Community from Share.
- `ShareDialog` takes an optional `community` prop (`published`, `onChange`); the gallery tile passes it wherever `onPublish` exists (generator pages and the studio library), so it shows both from the tile menu's Share and from the full-screen view's Share icon.
- A row under the share links: "Hive Studio Community", with **Add to Community** / **Remove from Community** (the same publish action as the tile menu; shows "Saving…" until it returns). It publishes the whole run, like the tile menu.
- `TileActions.onPublish` may now return a promise so the panel can wait on it.
