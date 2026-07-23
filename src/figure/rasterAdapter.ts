import type { Anchor, NormalisedRect, RegionId } from '../model/types'
import type { Context, FigureAdapter, FigureDescriptor, FigurePartDescriptor, Tone } from './adapter'

// This module is the ONLY place figure assets are read (Rule 3, enforced by
// an acceptance test). Assets are bundled — no network (Rule 4).
const descriptorModules = import.meta.glob('../packs/*/figures/*/figure.json', { eager: true }) as
  Record<string, { default: FigureDescriptor }>
const partUrlModules = import.meta.glob('../packs/*/figures/*/parts/*.png', {
  eager: true, query: '?url', import: 'default'
}) as Record<string, string>

interface LoadedPart {
  desc: FigurePartDescriptor
  image: HTMLImageElement
  /** Downsampled alpha map for hit-testing, cached at load (§3). */
  alpha: Uint8ClampedArray
}

const ALPHA_W = 128
const ALPHA_H = 256
const ALPHA_THRESHOLD = 24
/** Tap tolerance in alpha-map cells (each cell ≈ 8 figure px). */
const HIT_RADIUS = 5

const VIRTUAL_REGIONS: RegionId[] = ['whole-body', 'background']

export function listFigureDescriptors(): FigureDescriptor[] {
  return Object.values(descriptorModules).map((m) => m.default)
}

function partUrl(figureId: string, file: string): string {
  const entry = Object.entries(partUrlModules).find(([path]) =>
    path.includes(`/figures/${figureId}/${file}`))
  if (!entry) throw new Error(`missing figure part asset: ${figureId}/${file}`)
  return entry[1]
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to decode ${url}`))
    img.src = url
  })
}

export class RasterFigureAdapter implements FigureAdapter {
  private parts: LoadedPart[] = [] // sorted by zIndex ascending
  private tone: Tone = '#ddd5cc'
  private tintCache = new Map<string, HTMLCanvasElement>()
  private unionBounds: NormalisedRect = { x: 0, y: 0, w: 1, h: 1 }

  private constructor(readonly descriptor: FigureDescriptor) {}

  static async load(figureId: string): Promise<RasterFigureAdapter> {
    const descriptor = listFigureDescriptors().find((d) => d.id === figureId)
    if (!descriptor) throw new Error(`unknown figure: ${figureId}`)
    const adapter = new RasterFigureAdapter(descriptor)
    const canvas = document.createElement('canvas')
    canvas.width = ALPHA_W
    canvas.height = ALPHA_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    adapter.parts = await Promise.all(
      [...descriptor.parts].sort((a, b) => a.zIndex - b.zIndex).map(async (desc) => {
        const image = await loadImage(partUrl(figureId, desc.file))
        ctx.clearRect(0, 0, ALPHA_W, ALPHA_H)
        ctx.drawImage(image, 0, 0, ALPHA_W, ALPHA_H)
        const data = ctx.getImageData(0, 0, ALPHA_W, ALPHA_H).data
        const alpha = new Uint8ClampedArray(ALPHA_W * ALPHA_H)
        for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]
        return { desc, image, alpha }
      })
    )
    adapter.unionBounds = unionRects(adapter.parts.map((p) => p.desc.bounds))
    return adapter
  }

  getRegions(): RegionId[] {
    return [...this.parts.map((p) => p.desc.regionId), ...VIRTUAL_REGIONS]
  }

  getBounds(r: RegionId): NormalisedRect {
    if (r === 'whole-body') return { ...this.unionBounds }
    if (r === 'background') return { x: 0, y: 0, w: 1, h: 1 }
    const part = this.part(r)
    return { ...part.desc.bounds }
  }

  getPadding(r: RegionId): number {
    if (r === 'whole-body') return 0.04
    if (r === 'background') return 0
    return this.part(r).desc.padding
  }

  getAnchors(r: RegionId): Anchor[] {
    if (r === 'whole-body' || r === 'background') return []
    return this.part(r).desc.anchors.map((a) => ({ ...a }))
  }

  hitTest(x: number, y: number): RegionId | null {
    if (x < 0 || x > 1 || y < 0 || y > 1) return null
    const px = Math.min(ALPHA_W - 1, Math.floor(x * ALPHA_W))
    const py = Math.min(ALPHA_H - 1, Math.floor(y * ALPHA_H))
    // Topmost part above the alpha threshold, in reverse z-order (§3).
    // Fingers are not pixels: search outward in rings so thin parts (arms)
    // and small parts (hands) register on a near-miss tap. The nearest hit
    // wins; z-order breaks ties within a ring.
    for (let r = 0; r <= HIT_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const sx = px + dx
          const sy = py + dy
          if (sx < 0 || sy < 0 || sx >= ALPHA_W || sy >= ALPHA_H) continue
          for (let i = this.parts.length - 1; i >= 0; i--) {
            if (this.parts[i].alpha[sy * ALPHA_W + sx] > ALPHA_THRESHOLD) {
              return this.parts[i].desc.regionId
            }
          }
        }
      }
    }
    return null
  }

  renderUnderlay(ctx: Context, skinTone: Tone): void {
    this.tone = skinTone
    this.drawParts(ctx, () => 1)
  }

  renderRegionView(ctx: Context, r: RegionId): void {
    if (r === 'whole-body') {
      this.drawParts(ctx, () => 1)
      return
    }
    const surround = r === 'background' ? 0.25 : this.surroundOpacity
    this.drawParts(ctx, (part) => (part.regionId === r ? 1 : surround))
  }

  /** Surround opacity for the region view: 25% default, toggleable (§7). */
  private surroundOpacity = 0.25

  setSurroundOpacity(opacity: number): void {
    this.surroundOpacity = Math.min(1, Math.max(0, opacity))
  }

  private drawParts(ctx: Context, opacity: (p: FigurePartDescriptor) => number): void {
    const { width, height } = ctx.canvas
    for (const part of this.parts) {
      const a = opacity(part.desc)
      if (a <= 0) continue
      ctx.save()
      ctx.globalAlpha = a
      ctx.drawImage(this.tinted(part), 0, 0, width, height)
      ctx.restore()
    }
  }

  /**
   * Skin tone: parts are authored neutral greyscale and tinted at runtime
   * (§3). Multiply keeps ink lines dark; destination-in restores the alpha.
   */
  private tinted(part: LoadedPart): HTMLCanvasElement | HTMLImageElement {
    if (!part.desc.skin) return part.image
    const key = `${part.desc.regionId}:${this.tone}`
    let canvas = this.tintCache.get(key)
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = part.image.naturalWidth
      canvas.height = part.image.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(part.image, 0, 0)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = this.tone
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(part.image, 0, 0)
      this.tintCache.set(key, canvas)
    }
    return canvas
  }

  private part(r: RegionId) {
    const part = this.parts.find((p) => p.desc.regionId === r)
    if (!part) throw new Error(`figure ${this.descriptor.id} has no region ${r}`)
    return part
  }
}

function unionRects(rects: NormalisedRect[]): NormalisedRect {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
