import type { FigureAdapter } from '../figure'
import type { Item, NormalisedRect } from '../model/types'
import { renderStroke } from './strokeRender'

// Reference figure pixel space (matches authored figure canvases).
export const FIG_W = 1024
export const FIG_H = 2048

/** The item's region rect: union of its regions' bounds. Stroke points are
 *  normalised within this rect and never leave it (Rule 2). */
export function itemRect(adapter: FigureAdapter, item: Item): NormalisedRect {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0
  for (const r of item.regionIds) {
    const b = adapter.getBounds(r)
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: 1, h: 1 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export interface RenderedItem {
  canvas: HTMLCanvasElement
  /** canvas px per reference-figure px */
  pixelScale: number
}

// Items are updated immutably in the store, so a WeakMap gives us perfect
// cache invalidation: any edit produces a new Item object.
const cache = new WeakMap<Item, RenderedItem>()

export function renderItem(item: Item, rect: NormalisedRect): RenderedItem {
  const hit = cache.get(item)
  if (hit) return hit

  const rectWpx = Math.max(1, rect.w * FIG_W)
  const rectHpx = Math.max(1, rect.h * FIG_H)
  // Oversample small regions so a ring drawn at 6x pinch-zoom stays crisp.
  const pixelScale = Math.min(4, Math.max(1, 1400 / Math.max(rectWpx, rectHpx)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(rectWpx * pixelScale)
  canvas.height = Math.ceil(rectHpx * pixelScale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  for (const stroke of item.strokes) renderStroke(ctx, stroke, pixelScale)

  const rendered = { canvas, pixelScale }
  cache.set(item, rendered)
  return rendered
}
