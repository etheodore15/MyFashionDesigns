// Shape tools generate VECTOR outlines (point polygons) at creation time —
// the stored stroke stays pure path data (Rule 1).
import type { StrokeTool } from '../model/types'

type Pt = [number, number, number]

export function shapePoints(kind: StrokeTool, a: [number, number], b: [number, number]): Pt[] {
  switch (kind) {
    case 'line': return [[a[0], a[1], 0.5], [b[0], b[1], 0.5]]
    case 'rect': return rect(a, b)
    case 'ellipse': return ellipse(a, b)
    case 'star': return star(a, b)
    case 'heart': return heart(a, b)
    default: return [[a[0], a[1], 0.5], [b[0], b[1], 0.5]]
  }
}

export function isClosedShape(kind: StrokeTool): boolean {
  return kind === 'rect' || kind === 'ellipse' || kind === 'star' || kind === 'heart'
}

function rect(a: [number, number], b: [number, number]): Pt[] {
  return [
    [a[0], a[1], 0.5], [b[0], a[1], 0.5], [b[0], b[1], 0.5], [a[0], b[1], 0.5]
  ]
}

function ellipse(a: [number, number], b: [number, number], n = 64): Pt[] {
  const cx = (a[0] + b[0]) / 2
  const cy = (a[1] + b[1]) / 2
  const rx = Math.abs(b[0] - a[0]) / 2
  const ry = Math.abs(b[1] - a[1]) / 2
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t), 0.5])
  }
  return pts
}

function star(a: [number, number], b: [number, number], spikes = 5): Pt[] {
  const cx = (a[0] + b[0]) / 2
  const cy = (a[1] + b[1]) / 2
  const rx = Math.abs(b[0] - a[0]) / 2
  const ry = Math.abs(b[1] - a[1]) / 2
  const pts: Pt[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.45
    const t = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    pts.push([cx + rx * r * Math.cos(t), cy + ry * r * Math.sin(t), 0.5])
  }
  return pts
}

function heart(a: [number, number], b: [number, number], n = 60): Pt[] {
  const cx = (a[0] + b[0]) / 2
  const cy = (a[1] + b[1]) / 2
  const sx = Math.abs(b[0] - a[0]) / 2 / 16
  const sy = Math.abs(b[1] - a[1]) / 2 / 15
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    pts.push([cx + x * sx, cy + (y - 1) * sy, 0.5])
  }
  return pts
}
