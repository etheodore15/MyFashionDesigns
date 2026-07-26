// Builds figure part PNGs + descriptors from the artwork in assets-src/figures.
//
// TWO SOURCE FORMATS, same output:
//
//  1. Commissioned art (see docs/figure-art-spec.md) — a directory of
//     per-layer high-resolution PNGs, one per region, all sharing one canvas:
//         assets-src/figures/<figureId>/<regionId>.png
//     This is what the artist delivers; no vector round-trip needed.
//
//  2. The in-repo placeholder figures — a single master drawing whose named
//     part groups this script isolates one at a time.
//
// Authoring rules honoured here (Build Brief v0.4 §3):
//  - the whole figure is drawn ONCE, then separated into parts
//  - every part lands on the identical transparent canvas; parts are never
//    cropped to their content
//  - output is PNG with alpha, at figures/<figureId>/parts/<regionId>.png
//  - bounds are measured from the rendered alpha channel, so descriptors
//    never drift from the artwork.
import sharp from 'sharp'
import { readFile, mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC = path.join(ROOT, 'assets-src', 'figures')
const OUT = path.join(ROOT, 'src', 'packs', 'core', 'figures')
const ICONS = path.join(ROOT, 'public', 'icons')

/**
 * Layout coordinate space of the descriptors, and the pixel size parts are
 * written at. Stroke and layout maths are normalised against this, so raising
 * it only changes part image sharpness (and bundle size), nothing else.
 */
const CANVAS = { width: 1024, height: 2048 }

/** Region ids a full-body figure must provide (frozen taxonomy, §3). */
const FULL_BODY_REGIONS = [
  'legs-lower', 'legs-upper', 'foot-left', 'foot-right', 'hips', 'waist',
  'torso', 'shoulders', 'neck', 'head', 'arm-right', 'arm-left',
  'hand-right', 'hand-left'
]

/**
 * Default part list for a full-body figure whose art has not arrived yet.
 * zIndex follows the standard body stacking order; bounds are measured from
 * the delivered art, and anchors can be filled in once it exists.
 */
function fullBodyParts() {
  const SMALL = new Set(['foot-left', 'foot-right', 'hand-left', 'hand-right', 'head'])
  return FULL_BODY_REGIONS.map((regionId, i) => ({
    regionId,
    zIndex: 10 + i * 2,
    padding: SMALL.has(regionId) ? 0.1 : 0.06,
    anchors: []
  }))
}

/** @type {Record<string, {name: string, parts: Array<{regionId: string, zIndex: number, padding?: number, anchors?: Array<{id:string,x:number,y:number}>}>}>} */
const FIGURES = {
  'mannequin-tpose': {
    name: 'Standing Figure',
    parts: [
      { regionId: 'legs-lower', zIndex: 10, anchors: [{ id: 'knee', x: 0.5, y: 0.723 }, { id: 'ankle', x: 0.5, y: 0.886 }] },
      { regionId: 'legs-upper', zIndex: 12, anchors: [{ id: 'hip', x: 0.5, y: 0.48 }, { id: 'knee', x: 0.5, y: 0.723 }] },
      { regionId: 'foot-left', zIndex: 14, padding: 0.1, anchors: [{ id: 'ankle', x: 0.586, y: 0.886 }] },
      { regionId: 'foot-right', zIndex: 14, padding: 0.1, anchors: [{ id: 'ankle', x: 0.414, y: 0.886 }] },
      { regionId: 'hips', zIndex: 16, anchors: [{ id: 'hip', x: 0.5, y: 0.48 }] },
      { regionId: 'waist', zIndex: 18, anchors: [{ id: 'waist', x: 0.5, y: 0.416 }] },
      { regionId: 'torso', zIndex: 20, anchors: [{ id: 'waist', x: 0.5, y: 0.398 }] },
      { regionId: 'shoulders', zIndex: 21, anchors: [{ id: 'shoulder', x: 0.328, y: 0.233 }, { id: 'shoulder', x: 0.672, y: 0.233 }, { id: 'neck', x: 0.5, y: 0.219 }] },
      { regionId: 'neck', zIndex: 22, anchors: [{ id: 'neck', x: 0.5, y: 0.219 }] },
      { regionId: 'head', zIndex: 24, padding: 0.05, anchors: [{ id: 'neck', x: 0.5, y: 0.175 }] },
      { regionId: 'arm-right', zIndex: 26, anchors: [{ id: 'shoulder', x: 0.328, y: 0.229 }, { id: 'elbow', x: 0.213, y: 0.298 }, { id: 'wrist', x: 0.111, y: 0.356 }] },
      { regionId: 'arm-left', zIndex: 26, anchors: [{ id: 'shoulder', x: 0.672, y: 0.229 }, { id: 'elbow', x: 0.787, y: 0.298 }, { id: 'wrist', x: 0.889, y: 0.356 }] },
      { regionId: 'hand-right', zIndex: 28, padding: 0.1, anchors: [{ id: 'wrist', x: 0.111, y: 0.356 }] },
      { regionId: 'hand-left', zIndex: 28, padding: 0.1, anchors: [{ id: 'wrist', x: 0.889, y: 0.356 }] }
    ]
  },
  // Commissioned poses. These build automatically as soon as their PNG layer
  // directory lands in assets-src/figures/<id>/ — no code change needed.
  // Until then the build skips them with a note.
  'standing-side': { name: 'Side View', parts: fullBodyParts() },
  'standing-back': { name: 'Back View', parts: fullBodyParts() },
  'bust-form': {
    name: 'Bust',
    parts: [
      { regionId: 'torso', zIndex: 10, anchors: [{ id: 'waist', x: 0.5, y: 0.727 }] },
      { regionId: 'shoulders', zIndex: 12, anchors: [{ id: 'shoulder', x: 0.24, y: 0.41 }, { id: 'shoulder', x: 0.76, y: 0.41 }, { id: 'neck', x: 0.5, y: 0.385 }] },
      { regionId: 'neck', zIndex: 14, anchors: [{ id: 'neck', x: 0.5, y: 0.385 }] },
      { regionId: 'head', zIndex: 16, padding: 0.05, anchors: [{ id: 'neck', x: 0.5, y: 0.3 }] }
    ]
  }
}

function isolatePart(svgText, regionId) {
  // Hide every part group, then re-show only the target. Id selectors beat
  // class selectors, so no !important needed.
  const css = `<style>.part{display:none}#part-${regionId}{display:inline}</style>`
  return svgText.replace('</defs>', `${css}</defs>`)
}

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
  if (maxX < 0) throw new Error('part rendered empty')
  return {
    x: minX / info.width,
    y: minY / info.height,
    w: (maxX - minX + 1) / info.width,
    h: (maxY - minY + 1) / info.height
  }
}

const round = (v) => Math.round(v * 10000) / 10000

const exists = (p) => access(p).then(() => true, () => false)

/**
 * Locate a figure's artwork. Commissioned PNG layer directories win over the
 * in-repo placeholder drawings; returns null when neither is present so the
 * build can skip a pose whose art hasn't arrived.
 */
async function resolveSource(figureId) {
  const layerDir = path.join(SRC, figureId)
  if (await exists(layerDir)) return { kind: 'png-layers', dir: layerDir }
  const master = path.join(SRC, `${figureId}.svg`)
  if (await exists(master)) return { kind: 'master', file: master }
  return null
}

/**
 * One part as a full-canvas transparent PNG. Delivered layers are already
 * full-canvas (spec §5.2) so they only need resizing to the layout canvas;
 * `fit: fill` preserves the shared frame exactly — never crop to content.
 */
async function renderPart(source, regionId, masterText) {
  if (source.kind === 'png-layers') {
    const file = path.join(source.dir, `${regionId}.png`)
    if (!(await exists(file))) throw new Error(`missing layer PNG: ${regionId}.png`)
    return sharp(file)
      .resize(CANVAS.width, CANVAS.height, { fit: 'fill' })
      .png()
      .toBuffer()
  }
  return sharp(Buffer.from(isolatePart(masterText, regionId))).png().toBuffer()
}

async function buildFigure(figureId) {
  const cfg = FIGURES[figureId]
  const source = await resolveSource(figureId)
  if (!source) {
    console.log(`${figureId}: skipped — no artwork in assets-src/figures yet`)
    return false
  }
  const masterText = source.kind === 'master' ? await readFile(source.file, 'utf8') : null
  const partsDir = path.join(OUT, figureId, 'parts')
  await mkdir(partsDir, { recursive: true })

  const parts = []
  for (const part of cfg.parts) {
    const png = await renderPart(source, part.regionId, masterText)
    const bounds = await alphaBounds(png)
    await writeFile(path.join(partsDir, `${part.regionId}.png`), png)
    parts.push({
      regionId: part.regionId,
      file: `parts/${part.regionId}.png`,
      zIndex: part.zIndex,
      bounds: { x: round(bounds.x), y: round(bounds.y), w: round(bounds.w), h: round(bounds.h) },
      padding: part.padding ?? 0.06,
      skin: true,
      anchors: part.anchors ?? []
    })
    console.log(`${figureId}/${part.regionId}: bounds`, parts[parts.length - 1].bounds)
  }

  const descriptor = {
    schemaVersion: 1,
    taxonomyVersion: 1,
    id: figureId,
    name: cfg.name,
    canvas: CANVAS,
    skinTonePart: null,
    skeleton: null,
    parts
  }
  await writeFile(path.join(OUT, figureId, 'figure.json'), JSON.stringify(descriptor, null, 2))

  // Full-figure preview (QA only): the parts recomposited in z-order, which
  // also proves the layers reassemble into a complete figure.
  const previewDir = path.join(ROOT, 'assets-src', 'preview')
  await mkdir(previewDir, { recursive: true })
  // Composite at full size first — sharp resizes before compositing within a
  // single chain, which would shrink the base below the layers.
  const ordered = [...parts].sort((a, b) => a.zIndex - b.zIndex)
  const composited = await sharp({
    create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(ordered.map((p) => ({ input: path.join(OUT, figureId, p.file) })))
    .png()
    .toBuffer()
  await sharp(composited).resize(512, 1024).png().toFile(path.join(previewDir, `${figureId}.png`))
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

let built = 0
for (const figureId of Object.keys(FIGURES)) {
  if (await buildFigure(figureId)) built++
}
await buildIcons()
console.log(`figures + icons built (${built}/${Object.keys(FIGURES).length} figures have artwork)`)
