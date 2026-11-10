# Hive Studio: build spec

This is the spec of record. It was adapted on 2026-10-15 from the operator's "Higgsfield-style AI image, video and audio studio" build prompt and has three changes:
1. The placeholders are filled in (the confirmed and proposed values are in `decisions.md` D-001).
2. The lime accent is replaced by the **Markethive palette**. Hex values are still to be supplied (D-002).
3. The app is built in `kitcrew-site/hive-studio/` (D-003).

```
BRAND_NAME        = Hive Studio
APP_SLUG          = hive-studio
PRODUCTION_URL    = https://studio.kitcrew.ai          # proposed, confirm
EMAIL_FROM        = "Hive Studio <login@kitcrew.ai>"   # proposed, domain must be verified in Resend
SUPPORT_EMAIL     = support@kitcrew.ai                 # proposed, confirm
CREDIT_MARKUP     = 1.5                                # 50% over Higgsfield API cost
BRAND_PRIMARY     = {{MARKETHIVE_PRIMARY_HEX}}         # TBD from operator
BRAND_SECONDARY   = {{MARKETHIVE_SECONDARY_HEX}}       # TBD from operator
```

---

## 0. Role and mission
You are a senior full-stack engineer. Build **Hive Studio**, a production-grade web app modeled on **higgsfield.ai**. Signed-in users generate AI images, videos and audio with every model the Higgsfield API offers, pay for credits with Stripe, and keep their generations in a personal library.

It must match higgsfield.ai's layout, navigation, generator panel and feed, use a dark UI with **Markethive brand accents**, run on the stack below, and call the **Higgsfield API** for every generation. It must not be a demo: every visible control works end to end.

### Stack (locked)
| Concern | Choice |
|---|---|
| Framework | Next.js App Router, the version pinned by the Higgsfield template (16.3.8), React 19, TypeScript strict |
| Styling/UI | Tailwind v4 + shadcn (Base UI), `lucide-react`, zustand, `@tanstack/react-virtual`, all from the template |
| Auth | NextAuth / Auth.js v5, magic links only |
| Email | Resend + React Email |
| Database | MongoDB Atlas through the official `mongodb` driver, shared by the Auth.js adapter and the app |
| Payments | Stripe (Checkout, Subscriptions, Customer Portal, webhooks) |
| Generation | Higgsfield API, one server-side key |
| Media storage | Cloudflare R2. Higgsfield only keeps outputs for at least 7 days, so every finished output is copied to R2 |

### How to work
1. Work through the phases in §12. Stop at each checkpoint and report what works, how it was verified, and what's next.
2. Never invent a Higgsfield endpoint path, parameter name or enum value. Every model file cites its source URL. Unverified models go under "Unverified" in `docs/model-catalog.md` and stay out of the picker.
3. When docs and template disagree: the live docs win on API behavior, the template wins on UI patterns. Log each case in `docs/decisions.md`.
4. Ask the operator only about brand assets, final prices and legal copy. For anything else, pick a sensible default and log it.
5. Strict TypeScript: no `any`, `@ts-ignore` or `@ts-expect-error`. `pnpm typecheck`, `pnpm lint` and `pnpm build` pass at every phase.

---

## 1. Ground-truth sources
### 1a. GitHub `higgsfield-ai` (cloned into `./_reference/`, gitignored)
| Repo | Use |
|---|---|
| `app-templates` ★ | **The scaffold.** UI components, Quanta tokens (`styles/quanta/*`), `generation/platform.ts`, `poll.ts`, `upload*.ts`, `app/api/upload/route.ts`, `generation/catalog/**`, `lib/studio/use-runs.ts`. Read `AGENTS.md`, `layouts/AGENTS.md` and `components/studio/AGENTS.md` in full. |
| `higgsfield-js` (MIT) | Auth header, status lifecycle, `hf_webhook`, retry behavior |
| `higgsfield-client` (Apache-2.0) | Cross-check request, upload and retry semantics |
| `cli` (MIT), `MODELS.md` | Which models exist and their parameter ranges. CLI names are job-set types, **not** REST paths |
| `skills` (MIT), `higgsfield-generate/references/*` | Picker descriptions, badges, prompt guidance |
| `higgsfield` | Ignore |

Scaffold (run inside `hive-studio/`):
```bash
pnpm dlx shadcn@latest init -t next -n hive-studio --no-monorepo -y higgsfield-ai/app-templates/studio
```
License: `app-templates` has no LICENSE file. Keep its attribution comments and check again before launch (D-005).

### 1b. Higgsfield API docs (`https://docs.higgsfield.ai`)
Start from `/docs/llms.txt`. Read quickstart, authentication, requests, polling, webhooks, file-uploads, errors, rate-limits, billing-and-retention, the api-reference pages (overview, get request status, cancel), `/docs/models.md` and every model page, and `/docs/openapi.json`. `console.higgsfield.ai` is the source of truth for the model list and the per-model USD prices; the operator supplies an export of it. *(These hosts are blocked from the container right now; see D-004.)*

### 1c. Live site `https://higgsfield.ai` (the UI to copy)
Screenshot `/`, `/ai/image?model=gpt_image_2`, `/ai/video?model=seedance_2_5`, `/audio`, `/effects/use` plus one detail page, `/community`, `/pricing`, the login modal (look only), and the history, asset library and lightbox views, each at 1440px and 390px. Decline cookie banners and don't submit forms. Output: `docs/ui-inventory.md` and `docs/screens/`.

### 1d. Clone the UX, not the brand
Copy the layout, information architecture, interaction patterns and visual language: dark UI, bold condensed uppercase display headings, justified media feeds. Use the **Markethive palette** where Higgsfield uses lime. Never use Higgsfield's name, logo, marketing media, testimonials or copy. Use Hive Studio, our logo (ask for it, or use a clean placeholder wordmark) and our own copy. Model-provider icons from `public/model-icons/` are fine.

---

## 2. Architecture
```
Browser → prompt dock, pickers, direct PUT uploads, feed; polls GET /api/generations/status (our DB only)
Next.js server (auth() in every action/route)
  submitGeneration: validate vs catalog → price → debit (Mongo txn) → POST Higgsfield ?hf_webhook= → store request_id
  cancelGeneration: POST /requests/{id}/cancel → refund on canceled
  /api/upload: signed upload URL from Higgsfield
  /api/webhooks/higgsfield: verify token → re-fetch status → finalize (idempotent)
  /api/webhooks/stripe: verify signature → credits (idempotent)
  /api/cron/reconcile: resolve stuck runs
  finalize: copy to R2 → status → refund if failed/nsfw/canceled
MongoDB Atlas · Cloudflare R2 · Stripe · Resend
```
Changes from the template: remove BYOK (`KeyDialog` and the key cookie; use the platform key `HF_CREDENTIALS` on the server only). Replace the device cookie with Auth.js users. Move history and projects from IndexedDB to Mongo, keeping the `useRuns` interface. Make status updates webhook-first and never poll through server actions. Copy outputs to R2. Meter usage with credits billed through Stripe. Add the top nav.

## 3. Higgsfield API (server only, `lib/higgsfield/` + `import "server-only"`)
- Base `HF_API_BASE_URL`, default `https://api.higgsfield.ai`. Header `Authorization: Key {key_id}:{key_secret}`.
- Submit with `POST {BASE}/{model-path}`. The response is `{status:"queued", request_id, status_url, cancel_url}`.
- Webhook via `?hf_webhook=`, which is unsigned (D-007). The URL carries `gid` plus `t=HMAC_SHA256(gid, HF_WEBHOOK_SECRET)`, compared in constant time. Always re-fetch `GET /requests/{id}/status`. Dedupe on `{requestId, status}`. Reply within 10 seconds. Local dev runs reconcile-only unless `HF_WEBHOOK_BASE_URL` is set.
- Statuses: `queued` (cancelable), `in_progress`, then terminal `completed` / `failed` / `nsfw` / `canceled`. Refund on failed, nsfw and canceled.
- Cancel: `POST /requests/{id}/cancel` returns 202 while queued and 400 after the run starts.
- Uploads: `POST /files/generate-upload-url {content_type}` returns `{upload_url, public_url, content_type, upload_headers}`. The browser PUTs with exactly those headers and `credentials:"omit"`. Allowed types: JPEG, PNG, WebP, GIF, MP4, WAV. Never log signed URLs. Add a per-user rate limit and size limits.
- Retry 429 and 5xx with backoff and jitter. Use an idempotency key if the API supports one, otherwise a DB lock.

## 4. Model catalog
Start from the template's `generation/catalog/models/*.ts`. Add every REST-exposed model it lacks, one file each with its docs URL. Extend `Surface` to include `"audio"`. Add the picker metadata (`description`, `bestFor`, `badges` NEW/TOP/FAST/4K/AUDIO, `provider`, `icon`). Keep `docs/model-catalog.md` current, marking each model Live, Unverified or Not in API. The server re-validates everything with `parseSettings` and `media-inputs.ts` and rejects unknown models. Paths always come from the catalog.

## 5. Auth (Auth.js v5 + Resend)
`auth.ts` exports `{handlers, auth, signIn, signOut}`. Resend provider with a branded React Email template: a big brand-colored "Sign in to Hive Studio" button, a fallback link, an expiry note and a plain-text version. MongoDBAdapter. `strategy:"database"`. The session exposes only `id` and `role` (never the credit balance). Pages: `/login` (also a modal), `/login/check-email`, `/login/error`. `events.createUser` grants `SIGNUP_BONUS_CREDITS` through the ledger and sets `role:"user"`; the Stripe customer is created lazily at first checkout. Rate-limit magic links per email and per IP with a Mongo TTL collection. `proxy.ts` only redirects signed-out users away from `/assets`, `/account` and `/admin`; real authorization happens in each handler. Signed-out users can browse. Generate and Upload open the auth modal and keep the dock state.

## 6. Data model (Mongo, zod, idempotent `scripts/db-init.ts`)
`users` (adapter fields plus `role`, `stripeCustomerId` (unique sparse), `credits{subscription,topup}`, `plan`, `planRenewsAt`) · `generations` (indexes `{userId,createdAt:-1}`, `{hfRequestId}` unique sparse, `{status,updatedAt}`, `{isPublic,publishedAt:-1}`) · `projects` · `uploads` · `credit_ledger` (append-only, **unique `{reason,refType,refId}`**) · `stripe_events` (`_id`=event.id) · `hf_webhook_events` (unique `{requestId,status}`) · `presets` · `model_pricing` · `rate_limits` (TTL) · `reports`.

## 7. Credits and lifecycle
- `credits = ceil(hfUsdCost × 1.5 / CREDIT_USD_VALUE)`, with `CREDIT_USD_VALUE` defaulting to 0.01. `lib/billing/price.ts` exports `priceFor(modelId, settings, media)`, a pure, unit-tested function shared by the UI and the server. `model_pricing` can override the price or disable a model.
- Two buckets: `subscription` (reset on each paid invoice) and `topup` (never expires). Subscription credits are spent first.
- Submit: one transaction for the conditional debit, ledger entry, generation `pending_submit` and the concurrency check. Then call Higgsfield. A definite 4xx gets an idempotent refund and is marked `failed`. An unclear outcome is left for the reconciler.
- Finalize is idempotent with conditional transitions: completed runs get their outputs copied to R2 at `u/{userId}/{generationId}/{n}.{ext}`, and terminal failures get a refund. An nsfw block shows "Blocked by content filter. Credits refunded."
- The reconciler runs every minute (Vercel Cron, `CRON_SECRET`). It resolves `pending_submit` older than 2 minutes and in-flight runs idle for 3 minutes, and marks anything unfinished at 15 minutes as failed with a refund.
- `GET /api/generations/status?ids=` reads the DB only, checks ownership, and is polled every 3–4 seconds while runs are in flight.

## 8. Stripe
Plans in `lib/billing/plans.ts`: Free, Starter, Plus, Ultra, monthly or annual (annual shows "20% OFF"), plus top-up packs. Amounts stay `{{TBD}}` until the Phase 5 checkpoint, and nothing is "unlimited". Checkout with a lazily created customer, `metadata.userId` and `client_reference_id`. Customer Portal. Webhook with raw body and `constructEvent`, deduped on `stripe_events`. Event handling: `checkout.session.completed` (payment) grants top-up credits; `invoice.paid` (create/cycle) resets the subscription bucket and syncs the plan; `customer.subscription.updated` and `.deleted` sync the plan; `charge.refunded` claws credits back (never below zero) and flags the account for review. Send Resend receipts for top-ups.

## 9. UI
Use the template components and Quanta tokens with **the Markethive palette mapped onto the brand tokens** (D-002). The brand color is reserved for the Generate CTA and active states; other actions use ghost or outline buttons. Grotesk display face, sans for body text, mono for numbers.
- **Nav:** logo · Explore · Image · Video · Audio · Effects · Community · Pricing. Right side: credit pill (✦), brand-colored Upgrade button, avatar menu. Signed out: Login and Sign up. Mobile uses a sheet. Optional promo bar. EU cookie consent with no analytics before consent.
- **Routes:** `/` Explore · `/image`, `/video`, `/audio` (`?model=`, `?preset=`) · `/effects`, `/effects/[slug]` · `/community`, `/g/[id]` · `/assets` · `/projects/[id]` · `/pricing` · `/account`, `/account/billing` · `/login` · `/admin` · `/legal/{terms,privacy,acceptable-use}`.
- **Generator page:**
  - Left panel (about 380px): mode tabs, then the model card with a Change button that opens the searchable picker, sub-tabs, a reference drop zone that opens `AssetLibraryModal`, the prompt with an Enhance toggle and character count, then the settings row (headline pill, resolution, More → `SettingsDialog`) and a sticky brand-colored "Generate ✦ {cost}" button that turns into Cancel and opens the upgrade modal when credits run short.
  - Right canvas: History and How it works toggles, a density control, `ScreenEmptyState`, and the `UserGenerations` feed. Tile states are generating, failed, nsfw and completed. The hover rail has Download, Reuse, Animate, Upscale (if the API supports it), Publish, Add to project and Delete. `GenerationDetailModal` is the lightbox.
  - Mobile: the panel stacks and Generate becomes a bottom bar.
- **Polish:** motion tokens, reduced-motion support, visible focus, aria-labels that match tooltips, fixed aspect-ratio boxes, loaded media kept mounted, no inert controls.

## 10. Security
- Secrets only in server env with `server-only` imports. A build test greps `.next/static` for key prefixes.
- `auth()` and an ownership check in every handler, returning 404 for other users' IDs. zod plus catalog validation everywhere.
- Webhook verification and idempotency.
- Rate limits on magic links, uploads, submits and status polling.
- Credits change only on the server, through ledger transactions, and never go below zero.
- CSP, `frame-ancestors 'none'`, Referrer-Policy and HSTS.
- Community shows only published items, with report and unpublish.
- Final audit against the vibe-security checklist.

## 11. Env (`.env.example`; `lib/env.ts` validates with zod)
```
APP_URL=http://localhost:3000
NEXT_PUBLIC_BRAND_NAME=Hive Studio
AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_RESEND_KEY=
EMAIL_FROM="Hive Studio <login@kitcrew.ai>"
SIGNUP_BONUS_CREDITS=0
MONGODB_URI=
MONGODB_DB=hive-studio
HF_API_BASE_URL=https://api.higgsfield.ai
HF_CREDENTIALS=key_id:key_secret
HF_WEBHOOK_SECRET=
HF_WEBHOOK_BASE_URL=
CREDIT_USD_VALUE=0.01
CREDIT_MARKUP=1.5
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PLUS_MONTHLY=
STRIPE_PRICE_PLUS_ANNUAL=
STRIPE_PRICE_ULTRA_MONTHLY=
STRIPE_PRICE_ULTRA_ANNUAL=
STRIPE_PRICE_TOPUP_SMALL=
STRIPE_PRICE_TOPUP_MEDIUM=
STRIPE_PRICE_TOPUP_LARGE=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
CRON_SECRET=
```
Secrets are set by the operator in Vercel and locally. KitFire never enters keys.

## 12. Phases
| Phase | Scope | Checkpoint |
|---|---|---|
| 0 Research | Repos, docs, site → `ui-inventory.md`, `model-catalog.md`, `decisions.md`, `screens/` | Three docs exist, and every model has a status |
| 1 Scaffold | Template init, strip BYOK/device/IndexedDB, `env.ts`, Mongo, `db-init`, checks | App runs and checks pass |
| 2 Auth | Auth.js, Resend, adapter, email, login, `proxy.ts`, rate limits | A real magic link signs in, sign-out works, routes are protected |
| 3 Generation core | `lib/higgsfield`, submit, webhook, reconcile, status, `useRuns` on Mongo, R2, cancel | One image and one video generate for real, persist, are served from R2, and cancel works |
| 4 All models | Verified models, audio, picker metadata, re-validation, mapper tests | `toPlatform` snapshots and one real generation per family |
| 5 Credits and Stripe | Pricing, ledger, txns, plans, Checkout, Portal, webhook, receipts, upgrade modal | Idempotency and no-overdraw tests pass, and test-mode subscription and top-up credit the right buckets |
| 6 UI clone | All pages | Side-by-side screenshots at 1440 and 390 |
| 7 Content and polish | Our own media and copy, placeholders removed, a11y | No placeholders, Lighthouse a11y ≥95 |
| 8 Hardening and deploy | Audit, Playwright, Vercel, Atlas, R2 CORS, Stripe live checklist | E2E passes on a preview deploy, and `docs/runbook.md` exists |

Verification scenarios:
- Magic-link signup plus bonus credits.
- Prompt-only image. Video with frames and with references. Surface, model and setting changes update the cost.
- Insufficient credits opens the upgrade modal, and a top-up fixes it.
- nsfw, failed and canceled runs each refund exactly once, even with a duplicate webhook.
- Reconcile-only completion.
- Two-tab race: exactly one submit succeeds.
- Cross-user access returns 404.
- Feeds work with 0 and with 500+ items, and project CRUD works.
- At 390px: no horizontal scroll, and Generate stays reachable.

## 13. Out of scope for v1
Supercomputer agent, Canvas, Cinema Studio timelines, Marketing Studio flows, 3D, Academy, Contests, plugins, teams, Soul ID training (v2: a `characters` collection), and a public API.

## 14. Definition of done
- Every page exists, matches the inventory, and carries the Hive Studio brand, with no Higgsfield marks or placeholders.
- Every verified model generates for real. Unverified models appear only in the docs.
- Auth, credits, Stripe, webhooks and the reconciler work together, with tests.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass, and Playwright passes on a preview deploy.
- `README.md` covers setup, env, local webhooks (Stripe CLI and a tunnel), adding a model (one file plus `pnpm models`), and deployment.
