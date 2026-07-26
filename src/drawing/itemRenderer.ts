import type { FigureAdapter } from '../figure'
import type { Item, NormalisedRect } from '../model/types'
import { renderStroke } from './strokeRender'
import { extentFor, type ItemExtent } from './extent'

// Reference figure pixel space (matches authored figure canvases).
export const FIG_W = 1024
export const FIG_H = 2048

/** The item's region rect: union of its regions' bounds. Stroke points are
 *  normalised within this rect and never leave it (Rule 2). */
export function itemRect(adapter: FigureAdapter, item: Item): NormalisedRect {
  return regionsRect(adapter, item.regionIds)
}

/** Union of the given regions' bounds. */
export function regionsRect(adapter: FigureAdapter, regionIds: Item['regionIds']): NormalisedRect {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0
  for (const r of regionIds) {
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
  /** The region-local sub-space the canvas covers (strokes may overflow the rect). */
  extent: ItemExtent
}

// Items are updated immutably in the store, so a WeakMap gives us perfect
// cache invalidation: any edit produces a new Item object.
const cache = new WeakMap<Item, RenderedItem>()

export function renderItem(item: Item, rect: NormalisedRect): RenderedItem {
  const hit = cache.get(item)
  if (hit) return hit

  const extent = extentFor(item, rect, FIG_W, FIG_H)
  const extWpx = Math.max(1, (extent.x1 - extent.x0) * rect.w * FIG_W)
  const extHpx = Math.max(1, (extent.y1 - extent.y0) * rect.h * FIG_H)
  // Oversample small regions so a ring drawn at 6x pinch-zoom stays crisp.
  const pixelScale = Math.min(4, Math.max(0.5, 1400 / Math.max(extWpx, extHpx)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(extWpx * pixelScale)
  canvas.height = Math.ceil(extHpx * pixelScale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  for (const stroke of item.strokes) renderStroke(ctx, stroke, pixelScale, extent)

  const rendered = { canvas, pixelScale, extent }
  cache.set(item, rendered)
  return rendered
}
