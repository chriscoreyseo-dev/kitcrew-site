# UI inventory

Status 2026-10-15: **Part A is done; Part B is blocked.** higgsfield.ai can't be reached from the build container (see decisions D-004). No screenshots exist in `docs/screens/` yet, and nothing in Part B has been observed or guessed.

---

## Part A — What the template already provides (read from source, `_reference/app-templates`)

| Spec element (§9) | Template piece | Notes / changes needed |
|---|---|---|
| Generator dock (model, prompt, refs, settings, Generate/Cancel) | `PromptBox` primitive (`Root / ModeRail / Mode / Body / Field / Actions / Pill / Uploads / Upload / Generate`) + `StudioPromptBox` | `MAX_INLINE_SETTINGS = 1` matches the single "headline pill". The dock is horizontal; spec §9 wants a **~380px left panel**. Recompose it from `PromptBox` primitives and don't fork them. Surfaces `plain` / `glass` are available. |
| Model card + picker modal | Not present as described | `studio-prompt-box.tsx` has the model selection. The searchable grouped picker with badges and "from ✦N" is **new work** that extends the component. |
| Settings dialog | `SettingsDialog` | Renders enum → Select, range → Slider, boolean → switch straight from `model.settings`. Use as is. |
| Add-references / library | `AssetLibraryModal` (`asset-library.tsx`) | Uploads tab plus image/video/audio tabs, with per-kind capacity limits. Its data source moves from `lib/studio/uploads.ts` to the Mongo `uploads` collection and our generations. |
| Feed | `UserGenerations` (internals in `gallery/`, never import those directly) | Justified, row-virtualized. Rules: keep loaded media mounted during fast scroll, and never filter out failed runs. |
| Tile | `GenerationTile` (`generation-card.tsx`) | States in source: `generating`, `failed`; run statuses seen: `queued`, `completed`, `failed`, `nsfw`, `canceled`. Hover rail is `CardActions`: ≤3 visible, then "More actions" ⋯, with each `aria-label` taken from the action label. **Audio tile does not exist yet** (new). |
| Lightbox | `GenerationDetailModal` (`generation-detail.tsx`) | Add cost, created time, and publish / add-to-project actions. |
| Empty states | `ScreenEmptyState` | Dot-fade backdrop, three images, title, description, optional action. Used for "MAKE VIDEOS IN ONE CLICK" plus the three step cards. |
| Presets / effects grid | `ExamplePresets` / `TemplateCard` (`template-picker.tsx`) | The mock templates and `/presets/placeholder-*.svg` must be replaced (Phase 7). |
| Projects | `MyProjects`, `ProjectCreateModal`, `ProjectActions`, `StudioSidebar` | Remove the sidebar's key status row along with BYOK. |
| Hero atmosphere | `HERO_GLOW`, `HERO_DOTS`, `HERO_DOTS_MASK` in `layouts/studio.tsx`; `HeroComposition` | The glow is neutral grey. It can take a brand-color tint (D-002). |
| Key dialog | `KeyDialog` | **Delete** (platform key on the server). |
| Top nav, promo bar, cookie banner, pricing, account, admin, community, auth modal | Not in template | All new. The template says "no app header", and the spec overrides that (§2). |

Primitives in `components/ui/`: button, dialog, dropdown-menu, input, label, select, slider, tabs, tooltip. Add sheet, switch, popover, toast, badge, avatar, checkbox and table through `pnpm dlx shadcn@latest add`.

Design tokens: Quanta in `styles/quanta/**`, mapped to shadcn in `styles/theme.css`. The brand color is token-driven, so the Markethive re-theme only touches tokens (D-002).

---

## Part B — Live site observation (BLOCKED, needs network access to higgsfield.ai)

For each page, capture 1440px and 390px screenshots to `docs/screens/<page>-<width>.png`. Then record layout and spacing, type scale, and every state (empty / loading / generating / failed / content-filter / success), hover actions, modals, and responsive collapse.

- [ ] Header/nav (signed out and signed in), mobile sheet
- [ ] `/` Explore
- [ ] `/ai/image?model=gpt_image_2`
- [ ] `/ai/video?model=seedance_2_5`: Create / Edit / Motion Control tabs, model card, picker modal, References / Extend sub-tabs
- [ ] `/audio`
- [ ] `/effects/use` + one effect detail
- [ ] `/community`
- [ ] `/pricing`
- [ ] Login / sign-up modal (look only)
- [ ] History tab, asset library, detail / lightbox

Rules: decline cookie banners and don't submit any forms.
