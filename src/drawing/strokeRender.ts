import { getStroke } from 'perfect-freehand'
import type { Stroke } from '../model/types'
import { floodFill } from './floodFill'
import { isClosedShape } from './shapes'

// Reference figure canvas height — stroke.width is stored as a fraction of
// this so line weight is consistent at every zoom and export size.
export const REF_HEIGHT = 2048

/** The sub-space of region-local coordinates a canvas covers. */
export interface StrokeSpace { x0: number; y0: number; x1: number; y1: number }

const UNIT_SPACE: StrokeSpace = { x0: 0, y0: 0, x1: 1, y1: 1 }

/**
 * Renders one stroke onto a canvas covering `space` in region-local units
 * (default: the region rect itself, (0,0)–(1,1)). `pixelScale` is canvas px
 * per reference-figure px (used for line weights).
 */
export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, pixelScale: number, space: StrokeSpace = UNIT_SPACE): void {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const sw = space.x1 - space.x0
  const sh = space.y1 - space.y0
  const px = (p: [number, number, number]): [number, number, number] =>
    [((p[0] - space.x0) / sw) * w, ((p[1] - space.y0) / sh) * h, p[2]]
  const widthPx = Math.max(1.5, stroke.width * REF_HEIGHT * pixelScale)

  ctx.save()
  ctx.globalAlpha = stroke.opacity
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (stroke.tool) {
    case 'pencil': {
      const outline = getStroke(stroke.points.map(px), {
        size: widthPx,
        thinning: 0.55,
        smoothing: 0.6,
        streamline: 0.45,
        simulatePressure: stroke.points.every((p) => p[2] === 0.5)
      })
      ctx.fillStyle = stroke.colour
      pathFromPoints(ctx, outline as [number, number][], true)
      ctx.fill()
      break
    }
    case 'marker': {
      ctx.strokeStyle = stroke.colour
      ctx.lineWidth = widthPx * 2.1
      smoothPolyline(ctx, stroke.points.map(px))
      ctx.stroke()
      break
    }
    case 'eraser': {
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = widthPx * 2.4
      smoothPolyline(ctx, stroke.points.map(px))
      ctx.stroke()
      break
    }
    case 'fill': {
      const p = stroke.points[0]
      if (p) {
        const [fx, fy] = px(p)
        floodFill(ctx, fx, fy, stroke.colour)
      }
      break
    }
    default: {
      // Shape strokes: stored as vector outlines, drawn as stroked paths.
      ctx.strokeStyle = stroke.colour
      ctx.lineWidth = widthPx
      pathFromPoints(ctx, stroke.points.map(px), isClosedShape(stroke.tool))
      ctx.stroke()
    }
  }
  ctx.restore()
}

function pathFromPoints(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>[], close: boolean): void {
  ctx.beginPath()
  if (!pts.length) return
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  if (close) ctx.closePath()
}

/** Quadratic-midpoint smoothing for marker/eraser polylines. */
function smoothPolyline(ctx: CanvasRenderingContext2D, pts: [number, number, number][]): void {
  ctx.beginPath()
  if (!pts.length) return
  ctx.moveTo(pts[0][0], pts[0][1])
  if (pts.length < 3) {
    for (const p of pts) ctx.lineTo(p[0], p[1])
    return
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1])
}
