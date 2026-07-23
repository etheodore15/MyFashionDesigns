// Builds figure part PNGs + descriptors from the master SVGs in assets-src/figures.
//
// Authoring rules honoured here (Build Brief v0.4 §3):
//  - the whole figure is drawn ONCE per SVG; this script slices it into parts
//  - every part is rendered onto the identical transparent 1024x2048 canvas
//  - output is PNG with alpha, at figures/<figureId>/parts/<regionId>.png
//  - bounds are measured from the rendered alpha channel, so descriptors
//    never drift from the artwork.
import sharp from 'sharp'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC = path.join(ROOT, 'assets-src', 'figures')
const OUT = path.join(ROOT, 'src', 'packs', 'core', 'figures')
const ICONS = path.join(ROOT, 'public', 'icons')

const CANVAS = { width: 1024, height: 2048 }

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

async function buildFigure(figureId) {
  const cfg = FIGURES[figureId]
  const svgText = await readFile(path.join(SRC, `${figureId}.svg`), 'utf8')
  const partsDir = path.join(OUT, figureId, 'parts')
  await mkdir(partsDir, { recursive: true })

  const parts = []
  for (const part of cfg.parts) {
    const svg = isolatePart(svgText, part.regionId)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
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

  // Full-figure preview (QA only, written to scratchpad-style preview dir).
  const previewDir = path.join(ROOT, 'assets-src', 'preview')
  await mkdir(previewDir, { recursive: true })
  await sharp(Buffer.from(svgText)).resize(512, 1024).png().toFile(path.join(previewDir, `${figureId}.png`))
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

for (const figureId of Object.keys(FIGURES)) {
  await buildFigure(figureId)
}
await buildIcons()
console.log('figures + icons built')
