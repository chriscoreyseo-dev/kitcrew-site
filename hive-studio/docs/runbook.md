# Hive Studio runbook

One codebase, two deployments (D-055). `STUDIO_MODE` picks the sign-in, the wallet and who may frame the app. Everything secret is set by the operator in the host's environment screen. KitFire never sets a key.

| | MarketHive version | Public version |
|---|---|---|
| `STUDIO_MODE` | `markethive` | `standalone` |
| Where | MarketHive's Coolify (dev3 now, production later) | studio.kitcrew.ai (host not chosen) |
| Opened from | the Hive Studio badge on the member dashboard (overlay iframe) | its own URL |
| Sign-in | signed MarketHive handoff (D-056) | magic link (Auth.js + Resend) |
| Pays with | Hive credits = MarketHive `VAULT_BALANCE` (D-057) | studio credits via Stripe |
| Prices set in | `lib/billing/pricing-table.ts` (Higgsfield list cost) x `MARKETHIVE_MARKUP` (default 1.5, S580-DRL-02); MarketHive caps one charge with `ADMIN_PARAMS` `HIVE_STUDIO_MAX_CHARGE` | `lib/billing/pricing-table.ts` + `model_pricing` x `CREDIT_MARKUP`, plans in `lib/billing/plans.ts` |
| Framing | only MarketHive's origins | nobody |
| Storage | local volume (`STORAGE_DRIVER=local`) on dev3 | Cloudflare R2 |
| Database | MongoDB container (replica set) on dev3 | MongoDB Atlas |

## 1. MarketHive version on dev3

### Pieces
- **Studio app** in Coolify: project MarkethiveDEV → `HiveStudio-DEV3`. Public Git repo `chriscoreyseo-dev/kitcrew-site`, branch `claude/hive-studio`, build pack Docker Compose, base directory `/hive-studio`, compose file `/docker-compose.dev3.yml`. Services: `studio` (this app) + `mongo` (`mongo:7.0`, one-member replica set `rs0`), volumes `studio-media` and `studio-mongo`.
- **Domain**: `https://hive-studio.91.99.211.175.sslip.io` (port 3000). sslip.io because markethive.com has no wildcard DNS; Let's Encrypt rate-limits shared sslip.io names, so a real name (`studio-dev3.markethive.com`, an A record to 91.99.211.175 in MarketHive's DNS) is the durable fix.
- **MarketHive dev3 app** (`MarkethiveDEV3-Web`, branch `feature/builder-media-dev3`): `includes/hive_studio_lib.php`, `hive_studio_api.php` (wallet API), `hive_studio_launch.php` (badge → signed URL), `code/homepage_studio.js`, badge + overlay in `index_members.php`, migration `069_hive_studio.sql`.

### Environment

Studio (`HiveStudio-DEV3` → Environment Variables). Everything not listed here has a default in the compose file.

| Variable | Who | Value |
|---|---|---|
| `MARKETHIVE_SHARED_SECRET` | operator, secret | 32+ random chars (`openssl rand -hex 32`). The **same value** as MarketHive's `MH_HIVE_STUDIO_SECRET`. |
| `HF_CREDENTIALS` | operator, secret | Higgsfield `key_id:key_secret` |
| `HF_WEBHOOK_SECRET` | operator, secret | 32+ random chars |
| `HF_WEBHOOK_BASE_URL` | optional | `https://hive-studio.91.99.211.175.sslip.io` to get webhooks; empty = the in-process reconciler polls every minute |
| `MARKETHIVE_CREDITS_URL` | optional | MarketHive's wallet / add-credits page; defaults to the MarketHive home page |
| `BOOT_REQUIRED_GROUPS` | optional | default `db`: the studio boots with only the database and each feature refuses until its keys exist. Set `db,markethive,higgsfield,webhooks` once everything is in to make a missing key stop the boot. |

MarketHive dev3 (`MarkethiveDEV3-Web` → Environment Variables):

| Variable | Value |
|---|---|
| `MH_HIVE_STUDIO_URL` | `https://hive-studio.91.99.211.175.sslip.io` (no trailing slash) |
| `MH_HIVE_STUDIO_SECRET` | the shared secret above |

The badge only shows once both are set (`mh_hs_enabled()`).

### Database (MarketHive, mkh_dev3 only)
Run `files/database/migrations/069_hive_studio.sql` once. It creates `hive_studio_charges` and inserts `HIVE_STUDIO_PRICE_IMAGE / _VIDEO / _AUDIO` **empty**. Empty = not priced = the studio refuses that surface. Setting them is a price ruling (Chris), in MarketHive credits per generation, e.g. `UPDATE ADMIN_PARAMS SET PARAM_VALUE='0.50' WHERE PARAM_NAME='HIVE_STUDIO_PRICE_IMAGE'`.

### Deploy
1. Coolify → `MarkethiveDEV3-Web` → Git Source: confirm branch `feature/builder-media-dev3`, commit `HEAD`. Deploy (5-8 min).
2. Coolify → `HiveStudio-DEV3` → Deploy (first build about 5 min; the Docker build runs `pnpm build`).
3. Check by content, never status codes (dev3 answers 200 for every path):
   - `https://hive-studio.91.99.211.175.sslip.io/api/health` → `{"ok":true,"service":"hive-studio","mode":"markethive"}`
   - `POST https://dev3.markethive.com/hive_studio_api.php` with no signature → JSON `{"ok":false,"error":"bad_signature"}` (or `disabled` before the secret is set), not the HTML home page.
   - Signed in on dev3: the Hive Studio badge opens the overlay and the studio header shows the member's Hive-credit balance.

### Who can generate
`GENERATION_ACCESS=admins` (compose default) until prices are ruled: only members with `MEMBERS.IS_ADMIN = 1` can generate. Role follows MarketHive on every sign-in.

### How a charge moves
1. Generate → studio inserts the run (parallel limit checked) → `debit` by generation id → MarketHive deducts `VAULT_BALANCE` (conditional UPDATE), writes `hive_studio_charges` + a `COINS_PAYMENT` row (+ trigger reversal) and credits the main account (USER_ID 9), in one transaction.
2. Failed / nsfw / canceled / timed out → `refund` by the same id → MarketHive flips the row to `refunded` once and reverses every movement.
3. MarketHive unreachable → the run fails, `walletRefundPending` is set and the reconciler retries the refund every minute until MarketHive confirms. Refund of a ref that was never debited is a no-op, so retries are always safe.
4. Audit: `SELECT * FROM hive_studio_charges ORDER BY CREATED_AT DESC` (MarketHive) and `db.generations.find({ walletRefundPending: true })` (studio).

### Rotating the shared secret
Set the new value on **both** apps, redeploy both. Handoff tokens live 90 s and wallet calls are signed per request, so nothing else needs migrating. Old studio sessions stay valid until they expire (12 h); to end them early, `db.mh_sessions.deleteMany({})`.

### Production later
Same steps on MarketHive's production Coolify, with `MARKETHIVE_BASE_URL=https://markethive.com`, `MARKETHIVE_FRAME_ANCESTORS=https://markethive.com https://www.markethive.com`, a real domain, and migration 069 on the production database. Each of those is its own explicit go.

## 2. Public version: studio.kitcrew.ai (not deployed)

The host is Chris's pick, because it is new spend. Both are ready:

**Option A, Vercel.** Import `kitcrew-site`, Root Directory `hive-studio`, framework Next.js. `vercel.json` schedules `/api/cron/reconcile` every minute, which needs Vercel Pro (~$20/mo, also required for commercial use). Env: everything in `.env.example` for standalone mode (`STUDIO_MODE=standalone`, `AUTH_*`, `MONGODB_URI` (Atlas), `HF_*`, `STRIPE_*`, `R2_*`, `CRON_SECRET`). Leave `INTERNAL_CRON_SECONDS` at 0.

**Option B, any Docker host** (Coolify on a box Chris already pays for, or a VPS): `docker compose -f docker-compose.standalone.yml up -d --build` from `hive-studio/`, with the same env in the host's env screen. Uses Atlas and R2, so the host keeps no state. The in-process reconciler replaces Vercel Cron (keep it on one replica).

Either way:
1. DNS: `studio.kitcrew.ai` → the host.
2. Resend: verify the `kitcrew.ai` sending domain for `login@kitcrew.ai`.
3. Stripe: products and prices (amounts are Chris's, `lib/billing/plans.ts` stays `null` until then), webhook endpoint `https://studio.kitcrew.ai/api/webhooks/stripe` with `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`.
4. R2: bucket + public base URL; CORS is not needed (outputs are fetched server-side and served as plain GETs).
5. Higgsfield webhook: `HF_WEBHOOK_BASE_URL=https://studio.kitcrew.ai`.
6. First admin: sign in once, then set `role: "admin"` on that `users` document. `GENERATION_ACCESS=admins` until prices are set.
7. Never merge `claude/hive-studio` into `kitcrew-site/main`: GitHub Pages would publish the source.

## 3. Tests

```bash
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm e2e    # after pnpm build; Playwright, both modes, every external service mocked
```

The E2E suite (`e2e/`) starts `e2e/mocks/server.mjs` (Higgsfield, MarketHive wallet + a dashboard page that frames the studio, Resend, and an in-memory MongoDB replica set) and both studios against the production build. First run: `pnpm exec playwright install chromium`.

MarketHive's PHP side has its own CLI test (fake ADOdb with real rollback), kept with the session notes: `php hive_studio_lib_test.php <markethive checkout>`. It checks the shared signature test vector that `tests/markethive-signing.test.ts` also pins, so a change on either side that breaks compatibility fails both.

## 4. Troubleshooting

| Symptom | Look at |
|---|---|
| Overlay shows "Couldn't sign you in" | token older than 120 s (clock skew between servers), secret mismatch, or the link was reused (`handoff_nonces`) |
| Overlay is blank / refuses to load | the studio's CSP `frame-ancestors` must list the MarketHive origin exactly (`MARKETHIVE_FRAME_ANCESTORS`) |
| Signed in, then signed out on the next click | the browser dropped the third-party cookie: it needs https on the studio domain (`Secure; SameSite=None; Partitioned`) |
| "MarketHive credits are unavailable right now" | studio → `hive_studio_api.php`: secret mismatch (401 `bad_signature`), migration 069 not run (`disabled`), or Cloudflare blocking the server-to-server POST |
| "isn't priced yet" | the matching `HIVE_STUDIO_PRICE_*` is empty or 0 |
| "isn't open to your account yet" | `GENERATION_ACCESS=admins` and the member isn't `IS_ADMIN` |
| Studio doesn't boot | the startup log lists every missing variable per group; `BOOT_REQUIRED_GROUPS` decides which are fatal |
