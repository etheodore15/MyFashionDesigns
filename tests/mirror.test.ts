// Mirroring must land a drawing on the other limb accurately even when the
// pose is uneven — the two arms of a hand-on-hip or mid-stride figure have
// completely different boxes.
import { describe, expect, it } from 'vitest'
import { mirrorStrokePoints, type MirrorGeometry } from '../src/drawing/mirror'

const FIG_W = 1024
const FIG_H = 2048

/** Figure-normalised point → the source region's local space. */
const toLocal = (rect: MirrorGeometry['sourceRect'], x: number, y: number): [number, number, number] =>
  [(x - rect.x) / rect.w, (y - rect.y) / rect.h, 0.5]

/** A copy's local point back to figure-normalised space. */
const toFigure = (rect: MirrorGeometry['targetRect'], p: [number, number, number]) =>
  ({ x: rect.x + p[0] * rect.w, y: rect.y + p[1] * rect.h })

describe('mirror on a symmetric pose', () => {
  // Both arms straight out, mirror images of each other.
  const sourceRect = { x: 0.66, y: 0.22, w: 0.24, h: 0.15 }
  const targetRect = { x: 0.10, y: 0.22, w: 0.24, h: 0.15 }
  const g: MirrorGeometry = {
    sourceRect,
    targetRect,
    anchorPairs: [
      { from: { x: 0.672, y: 0.229 }, to: { x: 0.328, y: 0.229 } }, // shoulder
      { from: { x: 0.889, y: 0.356 }, to: { x: 0.111, y: 0.356 } }  // wrist
    ],
    figW: FIG_W,
    figH: FIG_H
  }

  it('reflects a point across the figure centre line', () => {
    const source = { x: 0.80, y: 0.30 }
    const [p] = mirrorStrokePoints([toLocal(sourceRect, source.x, source.y)], g)
    const landed = toFigure(targetRect, p)
    expect(landed.x).toBeCloseTo(1 - source.x, 2)
    expect(landed.y).toBeCloseTo(source.y, 2)
  })
})

describe('mirror on an uneven pose', () => {
  // Source arm out to the side (wide, short box); target arm bent down onto
  // the hip (narrow, tall box) — the case that used to stretch and misplace.
  const sourceRect = { x: 0.62, y: 0.20, w: 0.26, h: 0.14 }
  const targetRect = { x: 0.16, y: 0.21, w: 0.12, h: 0.30 }
  const shoulderFrom = { x: 0.64, y: 0.225 }
  const wristFrom = { x: 0.86, y: 0.315 }
  const shoulderTo = { x: 0.27, y: 0.225 }
  const wristTo = { x: 0.21, y: 0.485 }
  const g: MirrorGeometry = {
    sourceRect,
    targetRect,
    anchorPairs: [
      { from: shoulderFrom, to: shoulderTo },
      { from: wristFrom, to: wristTo }
    ],
    figW: FIG_W,
    figH: FIG_H
  }

  it('lands a cuff drawn at the wrist on the other wrist', () => {
    const [p] = mirrorStrokePoints([toLocal(sourceRect, wristFrom.x, wristFrom.y)], g)
    const landed = toFigure(targetRect, p)
    expect(landed.x).toBeCloseTo(wristTo.x, 2)
    expect(landed.y).toBeCloseTo(wristTo.y, 2)
  })

  it('lands a shoulder seam on the other shoulder', () => {
    const [p] = mirrorStrokePoints([toLocal(sourceRect, shoulderFrom.x, shoulderFrom.y)], g)
    const landed = toFigure(targetRect, p)
    expect(landed.x).toBeCloseTo(shoulderTo.x, 2)
    expect(landed.y).toBeCloseTo(shoulderTo.y, 2)
  })

  it('keeps a mid-sleeve mark half way along the target limb', () => {
    const mid = { x: (shoulderFrom.x + wristFrom.x) / 2, y: (shoulderFrom.y + wristFrom.y) / 2 }
    const [p] = mirrorStrokePoints([toLocal(sourceRect, mid.x, mid.y)], g)
    const landed = toFigure(targetRect, p)
    expect(landed.x).toBeCloseTo((shoulderTo.x + wristTo.x) / 2, 2)
    expect(landed.y).toBeCloseTo((shoulderTo.y + wristTo.y) / 2, 2)
  })

  // The canvas is 1:2, so a square on screen spans twice as much normalised
  // x as y. Sides of 0.04 x and 0.02 y are both 41 px.
  const squareOnScreen: [number, number, number][] = [
    toLocal(sourceRect, 0.70, 0.24), toLocal(sourceRect, 0.74, 0.24),
    toLocal(sourceRect, 0.74, 0.26), toLocal(sourceRect, 0.70, 0.26)
  ]
  const sideLength = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot((a.x - b.x) * FIG_W, (a.y - b.y) * FIG_H)

  it('does not distort: a square stays square', () => {
    const out = mirrorStrokePoints(squareOnScreen, g).map((p) => toFigure(targetRect, p))
    const lengths = [
      sideLength(out[0], out[1]), sideLength(out[1], out[2]),
      sideLength(out[2], out[3]), sideLength(out[3], out[0])
    ]
    // Equal side lengths after the transform: uniform scale, no stretching.
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0], 1)
  })

  it('falls back to a proportional fit when the figure offers no anchors', () => {
    const noAnchors: MirrorGeometry = { ...g, anchorPairs: [] }
    const out = mirrorStrokePoints(squareOnScreen, noAnchors).map((p) => toFigure(targetRect, p))
    // Still a square: the fallback scales uniformly rather than stretching
    // the drawing to fill a differently shaped box.
    expect(sideLength(out[0], out[1])).toBeCloseTo(sideLength(out[1], out[2]), 1)
  })
})
