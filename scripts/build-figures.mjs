// Builds figure part PNGs, descriptors and previews from the commissioned
// artwork in assets-src/figures (see docs/figure-art-spec.md).
//
// Each figure is a directory of per-layer high-resolution PNGs — one per
// region, all sharing one uncropped canvas — plus the artist's qa.json,
// which supplies the stacking order and joint anchor coordinates:
//     assets-src/figures/<figureId>/<regionId>.png
//     assets-src/figures/<figureId>/qa.json
//
// Authoring rules honoured here (Build Brief v0.4 §3):
//  - the whole figure is drawn once, then separated into parts
//  - every part lands on the identical transparent canvas; parts are never
//    cropped to their content
//  - output is PNG with alpha, at figures/<figureId>/parts/<regionId>.png
//  - bounds are measured from the delivered alpha channel, so descriptors
//    never drift from the artwork.
import sharp from 'sharp'
import { readdir, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC = path.join(ROOT, 'assets-src', 'figures')
const OUT = path.join(ROOT, 'src', 'packs', 'core', 'figures')
const PREVIEW_OUT = path.join(ROOT, 'src', 'packs', 'core', 'previews')
const ICONS = path.join(ROOT, 'public', 'icons')

/**
 * Layout coordinate space of the descriptors, and the pixel size parts are
 * written at. Stroke and layout maths are normalised against this, so raising
 * it only changes part sharpness — at a cost in bundle size and, more
 * importantly, in the memory the runtime underlay canvas consumes.
 */
const CANVAS = { width: 1024, height: 2048 }

/** Figure-select thumbnails: small, greyscale, tinted at runtime. */
const PREVIEW = { width: 320, height: 640 }

/**
 * The body fill the figures are authored in (docs/figure-art-spec.md §4), and
 * the neutral level we normalise it to.
 *
 * Skin tone is applied at runtime by multiplying the artwork by the chosen
 * colour. Multiplying can only darken, so leaving the fill at its authored
 * warm grey caps how light the figure can ever get — the palest tone still
 * came out a medium beige, and no genuinely fair skin was reachable.
 * Normalising the fill to near-white makes the multiply faithful: the figure
 * renders the tone that was picked, across the whole range. Ink and
 * construction lines scale with it and stay dark.
 */
const BODY_FILL = { r: 0xdd, g: 0xd5, b: 0xcc }
const NEUTRAL = 250
const TONE_GAIN = [NEUTRAL / BODY_FILL.r, NEUTRAL / BODY_FILL.g, NEUTRAL / BODY_FILL.b]

/** Display names, and the order figures are offered in. */
const FIGURE_NAMES = {
  'mannequin-tpose': 'Standing Figure',
  'standing-side': 'Side View',
  'standing-back': 'Back View',
  'bust-form': 'Bust',
  'runway': 'Runway Walk',
  'hand-on-hip': 'Hand on Hip',
  'bust-side': 'Bust, Side',
  'twirl': 'Twirl',
  'sitting': 'Sitting',
  'croquis': 'Fashion Croquis'
}

/** Small regions need more surrounding context when zoomed into (§3). */
const WIDE_PADDING = new Set(['foot-left', 'foot-right', 'hand-left', 'hand-right'])

/**
 * Which of the artist's joint anchors belong to each region. Anchor ids in the
 * descriptor use the taxonomy's side-less vocabulary (shoulder, elbow, wrist,
 * hip, knee, ankle, neck, waist); the delivered keys carry a side suffix.
 */
const REGION_ANCHORS = {
  head: ['neck'],
  neck: ['neck'],
  shoulders: ['neck', 'shoulder-left', 'shoulder-right'],
  torso: ['shoulder-left', 'shoulder-right', 'waist'],
  waist: ['waist'],
  hips: ['waist', 'hip'],
  'arm-left': ['shoulder-left', 'elbow-left', 'wrist-left'],
  'arm-right': ['shoulder-right', 'elbow-right', 'wrist-right'],
  'hand-left': ['wrist-left'],
  'hand-right': ['wrist-right'],
  'legs-upper': ['hip', 'knee-left', 'knee-right'],
  'legs-lower': ['knee-left', 'knee-right', 'ankle-left', 'ankle-right'],
  'foot-left': ['ankle-left'],
  'foot-right': ['ankle-right']
}

const exists = (p) => access(p).then(() => true, () => false)
const round = (v) => Math.round(v * 10000) / 10000

async function alphaBounds(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null // legitimately empty layer (a hidden far limb)
  return {
    x: minX / info.width,
    y: minY / info.height,
    w: (maxX - minX + 1) / info.width,
    h: (maxY - minY + 1) / info.height
  }
}

/** Anchors for one region, normalised 0–1 against the source canvas. */
function anchorsFor(regionId, anchors, canvas) {
  return (REGION_ANCHORS[regionId] ?? [])
    .filter((key) => anchors?.[key])
    .map((key) => ({
      id: key.replace(/-(left|right)$/, ''),
      x: round(anchors[key][0] / canvas.width),
      y: round(anchors[key][1] / canvas.height)
    }))
}

async function buildFigure(figureId) {
  const dir = path.join(SRC, figureId)
  const qaFile = path.join(dir, 'qa.json')
  if (!(await exists(qaFile))) {
    console.log(`${figureId}: skipped — no qa.json alongside the layer PNGs`)
    return false
  }
  const qa = JSON.parse(await readFile(qaFile, 'utf8'))
  const order = qa.stacking_order
  const partsDir = path.join(OUT, figureId, 'parts')
  await mkdir(partsDir, { recursive: true })

  const parts = []
  for (const [i, regionId] of order.entries()) {
    const file = path.join(dir, `${regionId}.png`)
    if (!(await exists(file))) throw new Error(`${figureId}: missing layer ${regionId}.png`)
    // Delivered layers are already full-canvas, so this only rescales the
    // shared frame — never a crop to content.
    // Full-colour PNG, never palette-quantised: a 256-entry palette cannot
    // hold the anti-aliased alpha ramp of an ink line, and the jagged edges
    // it produces are obvious as soon as a child zooms into a region.
    const png = await sharp(file)
      .resize(CANVAS.width, CANVAS.height, { fit: 'fill' })
      .linear(TONE_GAIN, [0, 0, 0])
      .png({ compressionLevel: 9 })
      .toBuffer()
    const bounds = await alphaBounds(png)
    await writeFile(path.join(partsDir, `${regionId}.png`), png)
    if (!bounds) {
      // e.g. the far hand in a true profile: keep the layer so the taxonomy
      // stays complete, but it can never be tapped or drawn on.
      console.log(`${figureId}/${regionId}: empty layer (not visible in this pose) — omitted from regions`)
      continue
    }
    parts.push({
      regionId,
      file: `parts/${regionId}.png`,
      zIndex: 10 + i * 2,
      bounds: { x: round(bounds.x), y: round(bounds.y), w: round(bounds.w), h: round(bounds.h) },
      padding: WIDE_PADDING.has(regionId) ? 0.1 : 0.06,
      skin: true,
      anchors: anchorsFor(regionId, qa.anchors, qa.canvas ?? { width: 4096, height: 8192 })
    })
  }

  const descriptor = {
    schemaVersion: 1,
    taxonomyVersion: 1,
    id: figureId,
    name: FIGURE_NAMES[figureId] ?? figureId,
    canvas: CANVAS,
    skinTonePart: null,
    skeleton: null,
    parts
  }
  await writeFile(path.join(OUT, figureId, 'figure.json'), JSON.stringify(descriptor, null, 2))

  // Figure-select preview: the sliced parts recomposited in z-order. Doubles
  // as proof that the layers reassemble into a complete figure. Composite at
  // full size first — sharp resizes before compositing within one chain.
  await mkdir(PREVIEW_OUT, { recursive: true })
  const composited = await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(parts.map((p) => ({ input: path.join(OUT, figureId, p.file) })))
    .png()
    .toBuffer()
  await sharp(composited)
    .resize(PREVIEW.width, PREVIEW.height)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(PREVIEW_OUT, `${figureId}.png`))

  console.log(`${figureId}: ${parts.length} regions, ${parts.reduce((n, p) => n + p.anchors.length, 0)} anchors`)
  return true
}

async function buildIcons() {
  await mkdir(ICONS, { recursive: true })
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="#e86fa4"/>
    <path d="M256 96 L216 136 L232 200 C 180 260 150 330 150 396 L 362 396 C 362 330 332 260 280 200 L 296 136 Z"
      fill="#faf7f2" stroke="#3a2430" stroke-width="14" stroke-linejoin="round"/>
    <path d="M232 200 C 248 214 264 214 280 200" fill="none" stroke="#3a2430" stroke-width="12" stroke-linecap="round"/>
    <path d="M190 340 C 232 356 280 356 322 340" fill="none" stroke="#3a2430" stroke-width="10" stroke-dasharray="18 14" stroke-linecap="round"/>
  </svg>`
  for (const size of [192, 512]) {
    await sharp(Buffer.from(icon)).resize(size, size).png().toFile(path.join(ICONS, `icon-${size}.png`))
  }
}

const available = (await readdir(SRC, { withFileTypes: true }))
  .filter((d) => d.isDirectory()).map((d) => d.name)
// Known figures first, in offer order; anything else the artist delivers follows.
const figureIds = [
  ...Object.keys(FIGURE_NAMES).filter((id) => available.includes(id)),
  ...available.filter((id) => !(id in FIGURE_NAMES))
]

// Drop output for figures whose art has been removed, so stale parts can't
// linger in the bundle. Guarded: with no source art at all this would wipe
// every built figure, which must never happen on a checkout missing assets.
if (figureIds.length > 0) {
  for (const stale of (await readdir(OUT).catch(() => []))) {
    if (!figureIds.includes(stale)) await rm(path.join(OUT, stale), { recursive: true, force: true })
  }
} else {
  console.log('no figure artwork found in assets-src/figures — leaving built output untouched')
}

let built = 0
for (const figureId of figureIds) {
  if (await buildFigure(figureId)) built++
}
await buildIcons()
console.log(`figures + icons built (${built}/${figureIds.length})`)
