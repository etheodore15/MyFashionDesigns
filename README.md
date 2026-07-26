# Your Drawings Real Life

Draw fashion designs **directly on the figure**. A child taps a region, the
view zooms in, she draws right there, taps done — and what she drew is exactly
where it stays, editable forever.

Built to **Build Brief v0.4** (decision-locked). First usable version.

## The four rules (§0 — violating any is a build failure)

1. **Figures are raster. Drawings are never raster.** Every stroke is stored
   as vector path data for the life of the design (`Stroke.points`). The
   figure underlay is presentation only. Rasterisation happens only at render
   time.
2. **Never bake the apply transform into stroke coordinates.** Points live in
   region-local normalised space permanently; `Item.transform` is applied at
   render time only. Enforced by tests (`tests/model.test.ts`).
3. **Nothing reads figure assets except the figure adapter.**
   `src/figure/rasterAdapter.ts` is the only module that touches
   `figures/…` assets. Enforced by tests (`tests/architecture.test.ts`).
4. **No network calls of any kind.** No analytics, telemetry, font fetches,
   error reporting or sharing backend. Everything is bundled and local; the
   PWA works fully offline after first load. Enforced by tests.

## Stack

React · Vite · TypeScript · Konva (canvas) · perfect-freehand (stroke
smoothing) · IndexedDB via `idb` (all persistence) · Zustand (state) ·
Tailwind (layout) · vite-plugin-pwa (offline). Pointer events only; no
File System Access API; no browser-only permissions — everything survives a
Capacitor wrap unchanged.

## Getting started

```bash
npm install
npm run dev        # develop
npm test           # acceptance + model tests
npm run build      # regenerates figure PNGs, type-checks, builds the PWA
npm run preview    # serve the production build
```

## Project layout

```
assets-src/figures/        Master SVGs — whole figure drawn once per file
scripts/build-figures.mjs  Slices SVGs into per-region 1024x2048 PNGs with
                           alpha, measures bounds, writes figure.json
src/packs/core/            The bundled free pack: manifest, tutorials (JSON),
                           figures (generated parts + descriptors)
src/packs/loader.ts        Pack loader — the only path to pack content
src/figure/                FigureAdapter interface + RasterFigureAdapter
                           (alpha hit-testing, renderUnderlay/renderRegionView,
                           runtime skin-tone tinting). Only reader of figure
                           assets (Rule 3).
src/model/                 Types, frozen 16-region taxonomy, factories,
                           per-region category menus with deform defaults
src/drawing/               Stroke rendering (perfect-freehand), shapes, flood
                           fill, per-item canvas cache, design compositing
src/store/                 Zustand stores: app/profiles/tutorials + editor
                           (design, undo/redo x100, adjust ops)
src/tutorial/              Event bus for the data-driven tutorial runner
src/components/            EditorCanvas (Konva stage: board + zoomed region
                           view, pinch zoom, draw capture), tool rail, colour
                           wheel, layers panel, adjust panel, tutorial overlay,
                           parental gate
src/screens/               S1 Landing · S2 Figure Select · S4/S5/S6/S7 Design
                           Board · S9 Finish · S10 Export · S12 My Designs
src/entitlements/          Subscription stubs (§8) — everything free here
tests/                     Architectural greps + model invariants (§13)
```

## How drawing works (§5 — draw in place)

Tap a region → the stage animates a zoom until the region fills the screen,
with the surrounding figure visible at 25% opacity (toggleable) for context →
strokes are captured straight into region-local normalised space (no mapping,
no transfer step) → done zooms back out. `transform` is written as identity;
S7 Adjust (nudge/resize/reorder/mirror/delete) changes only the transform.
Tapping a filled region reopens its strokes, fully editable, forever.

## Figures

Ten commissioned technical flats, delivered per `docs/figure-art-spec.md`:

| Tier | Figures |
|---|---|
| 1 | `mannequin-tpose` · `standing-side` · `standing-back` · `bust-form` |
| 2 | `runway` · `hand-on-hip` · `bust-side` |
| 3 | `twirl` · `sitting` · `croquis` |

Each arrives as a directory of per-layer 4096×8192 PNGs plus the artist's
`qa.json` (stacking order and joint anchors), in `assets-src/figures/<id>/`.
`npm run build:figures` slices them onto the app canvas, measures bounds from
the alpha channel, writes the descriptor and anchors, and renders a
figure-select preview by recompositing the sliced parts — which also proves
the layers reassemble. Parts are authored neutral greyscale and tinted at
runtime from twelve skin tones.

The build also normalises the authored body fill (`#DDD5CC`) to near-white.
Tone is applied by multiplying, and multiplying can only darken, so leaving
the fill at its authored grey capped how light the figure could ever be — no
fair skin was reachable. Normalising makes the multiply faithful: the figure
renders the tone that was picked, right across the range.

**Adding a figure is drop-in:** put the delivered folder in
`assets-src/figures/<id>/`, add a display name to `FIGURE_NAMES` in
`scripts/build-figures.mjs`, list the id in a pack manifest, and rebuild.

Layer PSDs are archived outside the repo (1.3 GB) and gitignored.

**Known limitation:** the figure underlay rasterises at 1024×2048, so at deep
pinch-zoom into a small region the *figure* line work softens. Drawings stay
vector and always render crisp. Fixing it means loading a higher-resolution
copy of the active region on demand — a real bundle-size trade-off, not yet
made.

> **§11 step 5 — STOP AND TEST**: with the loop working, put it in front of
> real children before building anything else. Also test the hand-drawn line
> weight at actual phone scale before commissioning more figures.

## Tutorials (§6)

Data-driven JSON in `src/packs/core/tutorials/`. A tutorial is a list of
steps (`icon`, `text`, optional `target`, `waitFor` event) plus the tools it
unlocks. Adding a tutorial requires only a new JSON file listed in the pack
manifest — no code. Free drawing is never locked; skip is always available
and still unlocks; a grown-up can unlock everything behind the hold-to-open
parental gate; badges, not scores.

## Out of scope

See Brief §10/§12. Notably: no sharing of any kind in this build — private
family circles are roadmapped as their own phase with their own privacy
review, because they would introduce the first server dependency.
