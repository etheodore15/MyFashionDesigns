# Figure Art Commission Spec — Your Drawings Real Life

**Version 1.0 · For the commissioned artist**
**Product:** a children's app where kids draw fashion designs *directly onto a figure*. The figure artwork you draw is the canvas they dress.

---

## 1. What we're commissioning

A set of **hand-drawn fashion technical flats**: mannequin-style figures with
no facial features, drawn the way a fashion spec sheet draws a garment —
clean confident ink line with visible hand character, dashed construction
lines, no shading. Each figure is delivered as **one drawing, separated into
named body-part layers** that reassemble exactly.

The app slices your layered file into parts automatically, recolours the
body at runtime into twelve skin tones, and lets children zoom into each
body part and draw on it. Your line work will be seen at every scale from a
whole figure on a phone screen to a fingernail-level zoom.

**Original artwork only.** Everything must be drawn by you from scratch — no
traced croquis, no stock or third-party template bodies, no AI-generated or
AI-assisted output. Work is commissioned as a full rights transfer
(work-for-hire); contract to accompany this spec.

---

## 2. Style

> Confident ink line with visible hand character and varying line weight —
> slightly irregular, never mechanically even. Construction shown the way a
> spec sheet shows it: seam lines, dashed topstitching, darts, princess
> seams, joint lines. Fine-liner-on-paper feel. **No shading, no rendering,
> no gradients, no texture fills.**

- Think: dress form / wooden mannequin / fashion croquis, drawn by hand in
  fine-liner. Friendly and warm, not clinical.
- **No facial features** (no eyes, nose, mouth). A dashed centre line and
  eye line on the head are welcome — kids draw the face and hair themselves.
- Construction lines that read as "sewing pattern": centre-front dashed
  line, bust line, waist line, hip line, princess seams, joint/segment lines
  at neck, shoulders, elbows, wrists, knees, ankles.
- Proportions: **child-friendly neutral, roughly 7–7.5 heads tall.** Not
  adult fashion-croquis proportions (no 9-head elongation, no exaggerated or
  sexualised anatomy). Slim-neutral mannequin silhouette; the child adds all
  character.

## 3. Canvas & resolution

| Property | Requirement |
|---|---|
| Canvas ratio | Portrait **1:2** (width : height), identical for every figure in the set |
| Master resolution | **4096 × 8192 px** minimum |
| Figure placement | Figure centred, filling ~92–96% of canvas height, feet near bottom edge |
| Background | Fully transparent. Nothing outside the figure. No cropping of parts |

Line weights at 4096 px wide (halve them if you think at 2048):

- Primary silhouette outline: **12–22 px**, varying along the stroke
- Secondary interior lines (part joins, wrists): 8–14 px
- Construction dashes: 6–9 px, dash pattern roughly 40 px dash / 30 px gap

**Phone test gate:** deliver **one figure first**. We will render it at
phone size and at deep zoom before the rest of the set is commissioned.
Line weight that sings at 4096 px can turn to mush at 400 px — expect one
round of weight adjustment on that first figure.

## 4. Colour palette (strict — the app recolours at runtime)

The body is tinted into 12 skin tones by multiplying colour over your
greyscale, so the palette is fixed and flat:

| Use | Colour |
|---|---|
| Body fill (all skin areas) | flat `#DDD5CC` — one value everywhere, no shading |
| Ink outlines | `#332D28` |
| Construction/dashed lines | `#7A7067` |
| Stand/base (bust figure only) | ink lines only, **no fill** |

No other colours, no opacity ramps, no soft brushes. Anti-aliased edges are
fine (expected); soft/feathered strokes are not.

## 5. Layer separation — the important part

Draw the **whole figure first** so line weight and proportion are unified —
then separate it into body-part layers. Never draw parts in isolation.

### 5.1 Layer names (fixed vocabulary — must match exactly)

Full-body figures use these **14 layers**:

```
head · neck · shoulders · torso · waist · hips
arm-left · arm-right · hand-left · hand-right
legs-upper · legs-lower · foot-left · foot-right
```

The bust figure uses 4: `head · neck · shoulders · torso` (the stand
belongs in `torso`).

Notes:
- `left`/`right` are always the **figure's anatomical** left/right, never the
  viewer's — so in a **front view** the figure's left arm appears on the
  viewer's right, and in a **back view** it appears on the viewer's left.
- In a **side view**, label by anatomy too: the arm and leg nearest the
  viewer belong to whichever side is facing us. Both arms and both legs must
  still exist as four separate layers even when the far limb is mostly
  hidden — draw the visible sliver of the far limb (and where nothing of it
  shows, deliver that layer as a fully transparent PNG rather than omitting
  it).
- `legs-upper` = both thighs in one layer; `legs-lower` = both calves.
- `shoulders` = the trapezius/upper-chest yoke band between neck and chest.
- `waist` = the band between ribcage and hips (roughly navel band).

### 5.2 Separation rules

1. Each layer contains that part's **fill and its ink/construction lines**,
   in place on the shared canvas. Turning all layers on must reproduce the
   complete figure exactly — no leftovers, no missing strokes.
2. **Overlap at every joint.** Each part must extend ~1–1.5% of canvas
   height (**80–120 px at 8192**) underneath its neighbour so no seams or
   gaps appear when parts are composited. E.g. the neck tucks up under the
   head and down under the shoulders; thigh tops tuck under the hips.
3. Parts are composited in this stacking order (later = on top):

   `legs-lower → legs-upper → feet → hips → waist → torso → shoulders →
   neck → head → arms → hands`

   Hide the overlapped edge inside the part that sits on top (e.g. the top
   edge of the neck needs no outline where the head covers it).
4. Where a pose makes parts cross (a hand resting on a hip), keep each part
   complete on its own layer — the stacking order resolves what shows.
5. One extra layer named **`anchors`** (delete-after-use): small crosses
   marking these joints — `neck, shoulder ×2, elbow ×2, wrist ×2, waist,
   hip, knee ×2, ankle ×2`. We record the coordinates, then discard the
   layer. It ships in the source file only.

### 5.3 The figure is drawn on from both sides

Children can place a drawing **in front of the figure or behind it**, and
switch at any time — long hair falling behind the shoulders, a cape behind
the body, a bag strap passing behind an arm. Two consequences for your art:

- **Never bake a background into any layer.** Everything outside the
  figure's own silhouette must be fully transparent, or it will hide the
  child's behind-the-figure drawings.
- **Clean alpha edges matter more than usual.** A white or dark halo that is
  invisible against our cream background becomes obvious the moment a bright
  drawing sits behind the figure. Export with straight (unpremultiplied)
  alpha; no matting against a background colour.

## 6. Deliverables & file formats

Per figure, all three:

1. **One PNG per layer, high resolution** — this is the deliverable the app
   consumes directly, so it matters most:
   - **4096 × 8192 px each**, 32-bit **PNG with alpha**, transparent background
   - **Every layer exported on the identical full canvas.** Do not crop,
     trim or auto-fit to content — a hand PNG is mostly empty space with the
     hand in the correct position. Cropped exports break placement.
   - Filenames are exactly the layer names in §5.1, lowercase:
     `head.png`, `neck.png`, `shoulders.png`, `torso.png`, `waist.png`,
     `hips.png`, `arm-left.png`, `arm-right.png`, `hand-left.png`,
     `hand-right.png`, `legs-upper.png`, `legs-lower.png`, `foot-left.png`,
     `foot-right.png`
   - Delivered in one folder per figure, named for the figure id in §7:
     `standing/head.png`, `standing/neck.png`, …
2. **Layered source file** — PSD, TIFF, Procreate or Clip Studio, layers
   named per §5.1 (so we can request edits without a redraw).
3. **Flattened full-figure PNG** at 4096 × 8192, transparent (for QA).

We handle slicing, bounds measurement and app integration from deliverable
1 — drop the folder in and the build takes it from there.

## 7. The set — poses to draw

> **Status: proposed, pending product-owner approval.** Tier 1 replaces the
> in-app placeholders and is approved to start (subject to the §3 phone
> test on the first figure). Confirm tiers 2–3 before starting them.

All poses: front-facing or near-front, feet visible, all 14 parts present
and separable, no foreshortening extreme enough to hide a body part.

**Tier 1 — the core set (start here).** These four ids are already wired
into the app's build; delivering a folder named for the id is all it takes.

| # | id (= folder name) | Pose |
|---|---|---|
| 1 | `mannequin-tpose` | **Front view.** Standing straight, weight even, arms out at ~30–40° from the body (A-pose), palms toward viewer, feet shoulder-width. The classic "dress me" mannequin. **This is the phone-test figure — deliver it first, alone.** |
| 2 | `standing-side` | **Side view.** Same figure and proportions turned to a true profile (or a hair off, ~85°), arms slightly forward of the body so they read as separate from the torso. For coats, silhouettes, heels, hair length. Both arms and both legs are separate layers — see §5.1. |
| 3 | `standing-back` | **Rear view.** Same figure and proportions from behind, arms out as in #1. For capes, back details, hair from behind, bag straps. Note `left`/`right` stay anatomical, so they swap sides on screen (§5.1). |
| 4 | `bust-form` | Dress-form bust on a simple stand: head, neck, shoulders, torso ending at high hip with a gently curved hem; slender pole and base drawn in ink only. Larger head/torso scale for detail work (jewellery, collars, hair). Four layers only. |

**Tier 2 — first pose pack** *(confirm before starting)*

| # | id | Pose |
|---|---|---|
| 5 | `runway` | Mid-stride runway walk, front view: one leg forward, arms swinging naturally, slight attitude in the shoulders. |
| 6 | `hand-on-hip` | Standing, one hand on hip (elbow out), other arm relaxed; slight hip tilt. |
| 7 | `bust-side` | The bust form in profile — pairs with #4 for collar and shoulder-line work. |

**Tier 3 — expression pack** *(confirm before starting)*

| # | id | Pose |
|---|---|---|
| 8 | `twirl` | Mid-twirl: arms raised/open, one foot lifted on pointe, body with gentle sway — made for skirts in motion. |
| 9 | `sitting` | Seated on a simple drawn stool, hands on knees — calm pose for detailed work. Stool in ink only, no fill (like the bust stand). |
| 10 | `croquis` | A taller 8.5-head fashion croquis, standing, subtle S-curve — for the older kids' "fashion basics" tutorial. Same style, slightly finer construction lines. |

Every figure in the set must share: identical canvas, identical palette,
consistent line weight and proportions (except `croquis`, which is
deliberately taller), and the same layer vocabulary.

**Front / side / back must be the same figure.** Tier 1 items 1–3 are one
character seen from three angles: same height, same head size, same waist
and hip level, same limb thickness. Line up the three views against each
other before delivering — a child switching views should feel the figure
turned around, not that three different people appeared.

## 8. Acceptance checklist (we QA against this)

- [ ] Canvas 1:2, ≥4096 × 8192, transparent, figure ~92–96% of height
- [ ] One PNG per layer, **every one on the full uncropped canvas**, named exactly per §5.1
- [ ] Layer PNGs delivered in a folder named for the figure id (§7)
- [ ] All layers present (including near-empty far limbs on side views); layered source file included
- [ ] Layers stacked = complete figure, matching the flattened PNG
- [ ] Composited in §5.2 stacking order: no gaps, no double outlines at any joint
- [ ] Every joint overlap ≥80 px (at 8192 height)
- [ ] Palette is exactly the three values in §4 (plus transparency); body fill one flat value
- [ ] No shading/gradients/textures; no facial features
- [ ] `anchors` layer present in source with all the joint crosses listed in §5.2 rule 5
- [ ] Straight (unpremultiplied) alpha, no background baked in, no halo over dark or bright colours (§5.3)
- [ ] Line weight readable on a 6″ phone at whole-figure zoom AND pleasant at 8× zoom-in (first figure gated on this test)
- [ ] Front / side / back views line up as one character (§7)
- [ ] Original work throughout; rights transfer signed

## 9. How your files reach the app

Drop the delivered folder in at `assets-src/figures/<figure-id>/` and run
`npm run build:figures`. The pipeline slices each layer onto the app canvas,
measures its bounds from the alpha channel, writes the figure descriptor and
renders a recomposited preview so we can confirm the layers reassemble into a
complete figure. No hand-editing of coordinates, and a pose whose art hasn't
arrived is simply skipped.

Also in this repo: `scripts/build-figures.mjs` (the slicer) and Build Brief
v0.4 §3 (binding art-style and authoring rules).
