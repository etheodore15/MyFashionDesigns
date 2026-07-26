import type { NormalisedRect } from '../model/types'

// Mirroring a drawing to the other side of the body.
//
// Flipping the points inside their own region box is only correct when the
// two limbs are posed identically. On an uneven pose — hand on hip, mid-
// stride, twirling — the source and target boxes differ in size, shape and
// angle, so a plain flip stretches the sleeve and drops it in the wrong
// place. Instead we mirror in figure space and then fit the drawing onto the
// target limb's own axis using the joint anchors (shoulder / elbow / wrist)
// that ship with each figure.
//
// The result is written as the copy's own region-local points, exactly as
// before: the copy is a new item authored in the target region's space, and
// its transform stays identity (Rule 2 untouched).

export interface Pt { x: number; y: number }

/** A matched joint, in figure-normalised coordinates. */
export interface AnchorPair { from: Pt; to: Pt }

export interface MirrorGeometry {
  sourceRect: NormalisedRect
  targetRect: NormalisedRect
  /** Joint anchors of the source regions paired with the target regions. */
  anchorPairs: AnchorPair[]
  figW: number
  figH: number
}

/** Rotation + uniform scale + translation, in figure pixel space. */
interface Similarity { a: number; b: number; cf: Pt; ct: Pt }

const IDENTITY: Similarity = { a: 1, b: 0, cf: { x: 0, y: 0 }, ct: { x: 0, y: 0 } }
const MIN_SCALE = 0.2
const MAX_SCALE = 5

const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length
})

/**
 * Least-squares similarity taking `from` onto `to` (Umeyama, 2D). Reflection
 * is handled separately — the points are already mirrored — so this only
 * needs to recover rotation, uniform scale and translation.
 */
function fitSimilarity(pairs: AnchorPair[]): Similarity {
  if (pairs.length === 0) return IDENTITY
  const cf = centroid(pairs.map((p) => p.from))
  const ct = centroid(pairs.map((p) => p.to))
  if (pairs.length === 1) return { a: 1, b: 0, cf, ct } // translation only

  let dot = 0, cross = 0, norm = 0
  for (const { from, to } of pairs) {
    const ax = from.x - cf.x, ay = from.y - cf.y
    const bx = to.x - ct.x, by = to.y - ct.y
    dot += ax * bx + ay * by
    cross += ax * by - ay * bx
    norm += ax * ax + ay * ay
  }
  if (norm < 1e-9) return { a: 1, b: 0, cf, ct }

  let a = dot / norm
  let b = cross / norm
  // Guard against degenerate anchor data producing an absurd scale.
  const scale = Math.hypot(a, b)
  if (scale < MIN_SCALE || scale > MAX_SCALE || !Number.isFinite(scale)) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale || 1))
    const k = clamped / (scale || 1)
    a *= k
    b *= k
  }
  return { a, b, cf, ct }
}

/**
 * Fallback when the figure offers fewer than two matched joints: map the
 * mirrored source box onto the target box with a single uniform scale, so the
 * drawing keeps its proportions instead of being stretched to fit.
 */
function fitFromRects(g: MirrorGeometry): Similarity {
  const { sourceRect: s, targetRect: t, figW, figH } = g
  const mirroredX = 1 - (s.x + s.w)
  const sw = Math.max(1e-6, s.w * figW), sh = Math.max(1e-6, s.h * figH)
  const tw = t.w * figW, th = t.h * figH
  const scale = Math.sqrt((tw / sw) * (th / sh))
  const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
  return {
    a: k,
    b: 0,
    cf: { x: (mirroredX + s.w / 2) * figW, y: (s.y + s.h / 2) * figH },
    ct: { x: (t.x + t.w / 2) * figW, y: (t.y + t.h / 2) * figH }
  }
}

function apply(p: Pt, s: Similarity): Pt {
  const dx = p.x - s.cf.x
  const dy = p.y - s.cf.y
  return {
    x: s.ct.x + s.a * dx - s.b * dy,
    y: s.ct.y + s.b * dx + s.a * dy
  }
}

/**
 * Re-express region-local stroke points so the drawing lands on the mirrored
 * limb, following that limb's actual position and angle.
 */
export function mirrorStrokePoints(
  points: [number, number, number][],
  g: MirrorGeometry
): [number, number, number][] {
  const similarity = g.anchorPairs.length >= 2
    ? fitSimilarity(g.anchorPairs.map(({ from, to }) => ({
        // Mirror the source joint before fitting: the reflection is what makes
        // this a mirror rather than a copy, and fitting the remainder keeps
        // the drawing on the target limb.
        from: { x: (1 - from.x) * g.figW, y: from.y * g.figH },
        to: { x: to.x * g.figW, y: to.y * g.figH }
      })))
    : fitFromRects(g)

  const { sourceRect: s, targetRect: t, figW, figH } = g
  return points.map(([px, py, pressure]) => {
    const figureX = 1 - (s.x + px * s.w) // mirror across the figure's centre
    const figureY = s.y + py * s.h
    const moved = apply({ x: figureX * figW, y: figureY * figH }, similarity)
    return [
      (moved.x / figW - t.x) / t.w,
      (moved.y / figH - t.y) / t.h,
      pressure
    ]
  })
}
