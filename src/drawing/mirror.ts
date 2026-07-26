import type { NormalisedRect } from '../model/types'

// Mirroring a drawing to the other side of the body.
//
// Flipping points inside their own region box only works when both limbs are
// posed identically. Fitting one rotation-and-scale over the whole limb is
// not enough either: a hand-on-hip arm doubles back (shoulder → elbow out →
// wrist in at the hip) while the other arm hangs almost straight, and no
// single similarity maps a bent chain onto a straight one — the best fit
// lands the drawing beside the arm rather than on it.
//
// So we map along the limb's bones. Each stroke point is expressed relative
// to the source bones — how far along, how far to the side — and rebuilt on
// the matching target bones. Upper arm lands on upper arm, forearm on
// forearm, whatever angle each is posed at. Contributions from the bones are
// blended by proximity so a stroke crossing the elbow stays continuous.
//
// The result is written as the copy's own region-local points: the copy is a
// new item authored in the target region's space with an identity transform
// (Rule 2 untouched).

export interface Pt { x: number; y: number }

export interface MirrorGeometry {
  sourceRect: NormalisedRect
  targetRect: NormalisedRect
  /**
   * Matching joint chains, ordered along the limb (shoulder → elbow → wrist),
   * in figure-normalised coordinates. Two or more joints enable bone mapping.
   */
  sourceJoints: Pt[]
  targetJoints: Pt[]
  figW: number
  figH: number
}

interface Bone { a: Pt; b: Pt; dir: Pt; perp: Pt; len: number }

/**
 * Blend falloff. Bones are combined by inverse distance so a stroke crossing
 * a joint stays continuous, but the falloff has to be sharp: two bones of a
 * bent limb map to very different places, so even a few percent of influence
 * from the wrong bone visibly skews a drawing. A fourth-power falloff leaves
 * the blend confined to roughly a joint's width.
 */
const BLEND_EPS = 400 // px², ~20px
const MIN_BONE = 1e-3

function toBones(joints: Pt[], figW: number, figH: number): Bone[] {
  const px = joints.map((j) => ({ x: j.x * figW, y: j.y * figH }))
  const bones: Bone[] = []
  for (let i = 0; i < px.length - 1; i++) {
    const a = px[i]
    const b = px[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < MIN_BONE) continue
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
    bones.push({ a, b, dir, perp: { x: -dir.y, y: dir.x }, len })
  }
  return bones
}

/**
 * Map a point from the source bones onto the target bones, mirrored.
 *
 * Negating the sideways offset is exactly what makes this a reflection: for a
 * limb whose target is the mirror of its source, this reproduces the mirrored
 * point precisely, so symmetric poses behave as they always did.
 */
function mapThroughBones(p: Pt, source: Bone[], target: Bone[]): Pt {
  let weight = 0
  let x = 0
  let y = 0
  for (let i = 0; i < Math.min(source.length, target.length); i++) {
    const s = source[i]
    const t = target[i]
    const relX = p.x - s.a.x
    const relY = p.y - s.a.y
    const along = (relX * s.dir.x + relY * s.dir.y) / s.len // 0 at start, 1 at end
    const aside = relX * s.perp.x + relY * s.perp.y
    const sideScale = t.len / s.len

    const mx = t.a.x + along * (t.b.x - t.a.x) - aside * sideScale * t.perp.x
    const my = t.a.y + along * (t.b.y - t.a.y) - aside * sideScale * t.perp.y

    // Weight by distance to this bone, so each part of a stroke follows the
    // bone it was drawn on.
    const clamped = Math.min(1, Math.max(0, along))
    const nearX = s.a.x + clamped * (s.b.x - s.a.x)
    const nearY = s.a.y + clamped * (s.b.y - s.a.y)
    const spread = (p.x - nearX) ** 2 + (p.y - nearY) ** 2 + BLEND_EPS
    const w = 1 / (spread * spread)

    weight += w
    x += w * mx
    y += w * my
  }
  return weight > 0 ? { x: x / weight, y: y / weight } : p
}

/**
 * Fallback for regions with no usable joint chain (a foot knows only its
 * ankle): reflect, then map box to box with a single uniform scale so the
 * drawing keeps its proportions instead of being stretched.
 */
function mapThroughRects(p: Pt, g: MirrorGeometry): Pt {
  const { sourceRect: s, targetRect: t, figW, figH } = g
  const sw = Math.max(1e-6, s.w * figW)
  const sh = Math.max(1e-6, s.h * figH)
  const scale = Math.min(5, Math.max(0.2, Math.sqrt(((t.w * figW) / sw) * ((t.h * figH) / sh))))
  const mirroredCentreX = (1 - (s.x + s.w / 2)) * figW
  const sourceCentreY = (s.y + s.h / 2) * figH
  return {
    x: (t.x + t.w / 2) * figW + (p.x - mirroredCentreX) * scale,
    y: (t.y + t.h / 2) * figH + (p.y - sourceCentreY) * scale
  }
}

/**
 * Re-express region-local stroke points so the drawing lands on the mirrored
 * limb, following that limb's own pose.
 */
export function mirrorStrokePoints(
  points: [number, number, number][],
  g: MirrorGeometry
): [number, number, number][] {
  const sourceBones = toBones(g.sourceJoints, g.figW, g.figH)
  const targetBones = toBones(g.targetJoints, g.figW, g.figH)
  const useBones = sourceBones.length > 0 && targetBones.length > 0

  const { sourceRect: s, targetRect: t, figW, figH } = g
  return points.map(([px, py, pressure]) => {
    const figureX = s.x + px * s.w
    const figureY = s.y + py * s.h
    const source = { x: figureX * figW, y: figureY * figH }
    // The bone path mirrors via the sideways offset; the rect path needs the
    // reflection applied to the point itself first.
    const moved = useBones
      ? mapThroughBones(source, sourceBones, targetBones)
      : mapThroughRects({ x: (1 - figureX) * figW, y: source.y }, g)
    return [
      (moved.x / figW - t.x) / t.w,
      (moved.y / figH - t.y) / t.h,
      pressure
    ]
  })
}
