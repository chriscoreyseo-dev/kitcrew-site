# Hive Studio

An AI image, video and audio studio on the Higgsfield API, with credits billed through Stripe. It lives inside `kitcrew-site` and deploys to Vercel separately (Root Directory = `hive-studio`).

**Status:** Phase 0 (research). The app code doesn't exist yet.

- Spec: [`docs/build-prompt.md`](docs/build-prompt.md)
- Decisions and open items: [`docs/decisions.md`](docs/decisions.md)
- UI inventory: [`docs/ui-inventory.md`](docs/ui-inventory.md)
- Model catalog: [`docs/model-catalog.md`](docs/model-catalog.md)

Reference repos are cloned to `_reference/` (gitignored, never committed):

```bash
mkdir -p _reference && cd _reference
for r in app-templates higgsfield-js higgsfield-client cli skills; do git clone --depth 1 https://github.com/higgsfield-ai/$r; done
```
