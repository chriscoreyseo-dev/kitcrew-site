# Hive Studio

An AI image, video and audio studio on the Higgsfield API, with credits billed through Stripe. It lives inside `kitcrew-site` and deploys to Vercel separately (Root Directory = `hive-studio`).

**Status:** Phases 0–7 code done. Phase 7 added brand art, a copy pass, an accessibility pass (Lighthouse 100) and `pnpm showcase` for effect covers. Live tests need Atlas, Resend, Higgsfield, R2 and Stripe test keys. Plan amounts and model prices are TBD. Next is Phase 8 (hardening, E2E, deploy, runbook).

- Spec: [`docs/build-prompt.md`](docs/build-prompt.md)
- Decisions and open items: [`docs/decisions.md`](docs/decisions.md)
- UI inventory: [`docs/ui-inventory.md`](docs/ui-inventory.md)
- Model catalog: [`docs/model-catalog.md`](docs/model-catalog.md)
- Agent/component contracts: [`AGENTS.md`](AGENTS.md)

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in what you have; boot lists what's missing
pnpm dev                     # http://localhost:3000
```

Secrets go in `.env.local` locally and in Vercel project env for deploys. They are never committed. The studio boots without them in development; generating needs `HF_CREDENTIALS`.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server; watches `generation/catalog/models/` |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | Static checks |
| `pnpm test` | Unit tests (vitest) |
| `pnpm build` | Production build, then the client-bundle secret scan |
| `pnpm db:init` | Create all MongoDB indexes (idempotent, needs `MONGODB_URI`) |
| `pnpm models` | Regenerate the model barrel after adding a model file |
| `pnpm presets:seed` | Upsert the starter effects |
| `pnpm brand:art` | Regenerate logo, favicon and brand art from `lib/brand.ts` |
| `pnpm showcase --email you@x.com` | Generate effect covers via the real lifecycle (needs Atlas, Higgsfield, R2) |

## Reference repos

Cloned to `_reference/` (gitignored, never committed):

```bash
mkdir -p _reference && cd _reference
for r in app-templates higgsfield-js higgsfield-client cli skills; do git clone --depth 1 https://github.com/higgsfield-ai/$r; done
```
