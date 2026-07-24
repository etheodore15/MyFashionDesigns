import type { Item, NormalisedRect, Stroke } from '../model/types'
import { REF_HEIGHT } from './strokeRender'

/**
 * An item's render extent in region-local units. (0,0)–(1,1) is the region
 * rect itself; strokes may overflow it (big hair, flowing skirts), so the
 * extent grows to cover every stroke plus its line width. Points are never
 * rewritten — overflow lives naturally in region-local space (Rule 2).
 */
export interface ItemExtent { x0: number; y0: number; x1: number; y1: number }

/** Safety cap so corrupt data can't demand an absurd canvas. */
const MAX_OVERFLOW = 3

export function itemExtent(strokes: Stroke[], rect: NormalisedRect, figW: number, figH: number): ItemExtent {
  let x0 = 0, y0 = 0, x1 = 1, y1 = 1
  for (const stroke of strokes) {
    const widthFigPx = stroke.width * REF_HEIGHT * 2.5
    const mx = widthFigPx / Math.max(1, rect.w * figW)
    const my = widthFigPx / Math.max(1, rect.h * figH)
    for (const p of stroke.points) {
      if (p[0] - mx < x0) x0 = p[0] - mx
      if (p[0] + mx > x1) x1 = p[0] + mx
      if (p[1] - my < y0) y0 = p[1] - my
      if (p[1] + my > y1) y1 = p[1] + my
    }
  }
  return {
    x0: Math.max(-MAX_OVERFLOW, x0),
    y0: Math.max(-MAX_OVERFLOW, y0),
    x1: Math.min(1 + MAX_OVERFLOW, x1),
    y1: Math.min(1 + MAX_OVERFLOW, y1)
  }
}

export function extentFor(item: Item, rect: NormalisedRect, figW: number, figH: number): ItemExtent {
  return itemExtent(item.strokes, rect, figW, figH)
}
