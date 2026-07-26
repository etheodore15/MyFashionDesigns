// Mirroring must land a drawing on the other limb accurately even when the
// pose is uneven. The hand-on-hip figure is the hard case: its bent arm
// doubles back (shoulder → elbow out → wrist in at the hip) while the other
// arm hangs almost straight, so no single rotate-and-scale can map one onto
// the other.
import { describe, expect, it } from 'vitest'
import { mirrorStrokePoints, type MirrorGeometry, type Pt } from '../src/drawing/mirror'

const FIG_W = 1024
const FIG_H = 2048

const toLocal = (rect: MirrorGeometry['sourceRect'], p: Pt): [number, number, number] =>
  [(p.x - rect.x) / rect.w, (p.y - rect.y) / rect.h, 0.5]

const toFigure = (rect: MirrorGeometry['targetRect'], p: [number, number, number]): Pt =>
  ({ x: rect.x + p[0] * rect.w, y: rect.y + p[1] * rect.h })

/** Distance from a point to a segment, in figure pixels. */
function distanceToBone(p: Pt, a: Pt, b: Pt): number {
  const ax = a.x * FIG_W, ay = a.y * FIG_H
  const bx = b.x * FIG_W, by = b.y * FIG_H
  const px = p.x * FIG_W, py = p.y * FIG_H
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

describe('symmetric pose (standing figure)', () => {
  const sourceRect = { x: 0.664, y: 0.220, w: 0.244, h: 0.145 }
  const targetRect = { x: 0.092, y: 0.220, w: 0.244, h: 0.145 }
  const g: MirrorGeometry = {
    sourceRect,
    targetRect,
    sourceJoints: [{ x: 0.672, y: 0.229 }, { x: 0.787, y: 0.298 }, { x: 0.889, y: 0.356 }],
    targetJoints: [{ x: 0.328, y: 0.229 }, { x: 0.213, y: 0.298 }, { x: 0.111, y: 0.356 }],
    figW: FIG_W,
    figH: FIG_H
  }

  it('reproduces an exact reflection', () => {
    for (const source of [{ x: 0.80, y: 0.30 }, { x: 0.70, y: 0.24 }, { x: 0.87, y: 0.34 }]) {
      const [p] = mirrorStrokePoints([toLocal(sourceRect, source)], g)
      const landed = toFigure(targetRect, p)
      expect(landed.x).toBeCloseTo(1 - source.x, 3)
      expect(landed.y).toBeCloseTo(source.y, 3)
    }
  })
})

// Real anchors and bounds from src/packs/core/figures/hand-on-hip/figure.json.
const BENT = {
  rect: { x: 0.1602, y: 0.1836, w: 0.2578, h: 0.2319 },
  joints: [{ x: 0.369, y: 0.205 }, { x: 0.199, y: 0.314 }, { x: 0.332, y: 0.384 }]
}
const STRAIGHT = {
  rect: { x: 0.627, y: 0.1909, w: 0.1846, h: 0.3003 },
  joints: [{ x: 0.672, y: 0.205 }, { x: 0.727, y: 0.345 }, { x: 0.782, y: 0.466 }]
}

describe('drawing on the bent arm, mirrored to the straight arm', () => {
  const g: MirrorGeometry = {
    sourceRect: BENT.rect,
    targetRect: STRAIGHT.rect,
    sourceJoints: BENT.joints,
    targetJoints: STRAIGHT.joints,
    figW: FIG_W,
    figH: FIG_H
  }

  const landOf = (source: Pt) =>
    toFigure(STRAIGHT.rect, mirrorStrokePoints([toLocal(BENT.rect, source)], g)[0])

  it('puts a mark on the bent upper arm onto the straight upper arm', () => {
    // Half way down the bent upper arm, right on the bone.
    const source = {
      x: (BENT.joints[0].x + BENT.joints[1].x) / 2,
      y: (BENT.joints[0].y + BENT.joints[1].y) / 2
    }
    const landed = landOf(source)
    const onBone = distanceToBone(landed, STRAIGHT.joints[0], STRAIGHT.joints[1])
    expect(onBone).toBeLessThan(30) // within 30px of the target upper arm
  })

  it('puts a mark on the bent forearm onto the straight forearm', () => {
    const source = {
      x: (BENT.joints[1].x + BENT.joints[2].x) / 2,
      y: (BENT.joints[1].y + BENT.joints[2].y) / 2
    }
    const landed = landOf(source)
    const onBone = distanceToBone(landed, STRAIGHT.joints[1], STRAIGHT.joints[2])
    expect(onBone).toBeLessThan(30)
  })

  it('lands the joints on the matching joints', () => {
    const apart = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * FIG_W, (a.y - b.y) * FIG_H)
    expect(apart(landOf(BENT.joints[1]), STRAIGHT.joints[1])).toBeLessThan(40)
    expect(apart(landOf(BENT.joints[2]), STRAIGHT.joints[2])).toBeLessThan(60)
  })

  it('never strands the drawing off the limb — the reported bug', () => {
    // Sample the whole bent arm; every point must stay near the target arm.
    const samples: Pt[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      samples.push({
        x: BENT.joints[0].x + t * (BENT.joints[1].x - BENT.joints[0].x),
        y: BENT.joints[0].y + t * (BENT.joints[1].y - BENT.joints[0].y)
      })
      samples.push({
        x: BENT.joints[1].x + t * (BENT.joints[2].x - BENT.joints[1].x),
        y: BENT.joints[1].y + t * (BENT.joints[2].y - BENT.joints[1].y)
      })
    }
    for (const s of samples) {
      const landed = landOf(s)
      const nearest = Math.min(
        distanceToBone(landed, STRAIGHT.joints[0], STRAIGHT.joints[1]),
        distanceToBone(landed, STRAIGHT.joints[1], STRAIGHT.joints[2])
      )
      expect(nearest).toBeLessThan(60)
    }
  })

  it('does not stretch: a square stays square', () => {
    // 41px on both sides — the canvas is 1:2, so x spans twice the y.
    const mid = {
      x: (BENT.joints[0].x + BENT.joints[1].x) / 2,
      y: (BENT.joints[0].y + BENT.joints[1].y) / 2
    }
    const square = [
      { x: mid.x - 0.02, y: mid.y - 0.01 }, { x: mid.x + 0.02, y: mid.y - 0.01 },
      { x: mid.x + 0.02, y: mid.y + 0.01 }, { x: mid.x - 0.02, y: mid.y + 0.01 }
    ]
    const out = mirrorStrokePoints(square.map((p) => toLocal(BENT.rect, p)), g)
      .map((p) => toFigure(STRAIGHT.rect, p))
    const side = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * FIG_W, (a.y - b.y) * FIG_H)
    const lengths = [side(out[0], out[1]), side(out[1], out[2]), side(out[2], out[3]), side(out[3], out[0])]
    // Away from the joints the mapping is rigid; allow a little give for the
    // blend between bones.
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.1)
  })
})

describe('no joint chain available (a foot knows only its ankle)', () => {
  const g: MirrorGeometry = {
    sourceRect: { x: 0.52, y: 0.88, w: 0.13, h: 0.05 },
    targetRect: { x: 0.35, y: 0.88, w: 0.13, h: 0.05 },
    sourceJoints: [],
    targetJoints: [],
    figW: FIG_W,
    figH: FIG_H
  }

  it('still mirrors, proportionally', () => {
    const out = mirrorStrokePoints([
      toLocal(g.sourceRect, { x: 0.55, y: 0.89 }),
      toLocal(g.sourceRect, { x: 0.59, y: 0.89 }),
      toLocal(g.sourceRect, { x: 0.59, y: 0.91 })
    ], g).map((p) => toFigure(g.targetRect, p))
    const side = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * FIG_W, (a.y - b.y) * FIG_H)
    expect(side(out[0], out[1])).toBeCloseTo(side(out[1], out[2]), 0)
    // and it lands on the other foot
    expect(out[0].x).toBeGreaterThan(g.targetRect.x - 0.05)
    expect(out[0].x).toBeLessThan(g.targetRect.x + g.targetRect.w + 0.05)
  })
})
