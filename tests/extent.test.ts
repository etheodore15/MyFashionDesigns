// Stroke overflow: ink may extend beyond the region rect; the render extent
// grows to cover it while stored points are never rewritten (Rule 2).
import { describe, expect, it } from 'vitest'
import { itemExtent } from '../src/drawing/extent'
import { createStroke } from '../src/model/factories'

const rect = { x: 0.35, y: 0.03, w: 0.27, h: 0.15 }

describe('itemExtent', () => {
  it('is the unit square for strokes inside the rect', () => {
    const s = createStroke('pencil', '#000', 0.003, 1, [[0.2, 0.2, 0.5], [0.8, 0.9, 0.5]])
    const e = itemExtent([s], rect, 1024, 2048)
    expect(e.x0).toBeLessThanOrEqual(0)
    expect(e.y0).toBeLessThanOrEqual(0)
    expect(e.x1).toBeGreaterThanOrEqual(1)
    expect(e.y1).toBeGreaterThanOrEqual(1)
    expect(e.x0).toBeGreaterThan(-0.2)
    expect(e.x1).toBeLessThan(1.2)
  })

  it('grows to cover overflowing strokes (hair above the head)', () => {
    const s = createStroke('pencil', '#000', 0.003, 1, [[-0.4, -0.6, 0.5], [1.3, 0.5, 0.5]])
    const e = itemExtent([s], rect, 1024, 2048)
    expect(e.x0).toBeLessThan(-0.4)
    expect(e.y0).toBeLessThan(-0.6)
    expect(e.x1).toBeGreaterThan(1.3)
  })

  it('caps runaway extents from corrupt data', () => {
    const s = createStroke('pencil', '#000', 0.003, 1, [[-99, 0.5, 0.5], [99, 0.5, 0.5]])
    const e = itemExtent([s], rect, 1024, 2048)
    expect(e.x0).toBeGreaterThanOrEqual(-3)
    expect(e.x1).toBeLessThanOrEqual(4)
  })
})
