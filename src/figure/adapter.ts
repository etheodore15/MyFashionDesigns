import type { Anchor, NormalisedRect, RegionId } from '../model/types'

export type Tone = string
export type Context = CanvasRenderingContext2D

/**
 * Figure adapter (Rule 3): nothing reads figure assets except the adapter.
 * One interface, one implementation now (RasterFigureAdapter), more later.
 */
export interface FigureAdapter {
  getRegions(): RegionId[]
  getBounds(r: RegionId): NormalisedRect
  getPadding(r: RegionId): number
  getAnchors(r: RegionId): Anchor[]
  /** x/y normalised 0..1 against the figure canvas. */
  hitTest(x: number, y: number): RegionId | null
  renderUnderlay(ctx: Context, skinTone: Tone): void
  /** Target region at full opacity, surround (within padding) dimmed (§3/§5). */
  renderRegionView(ctx: Context, r: RegionId): void
  /** Optional: surround opacity for renderRegionView (25% / faint / off toggle, §7). */
  setSurroundOpacity?(opacity: number): void
}

/** Descriptor shapes (figure.json, schemaVersion 1). */
export interface FigurePartDescriptor {
  regionId: RegionId
  file: string
  zIndex: number
  bounds: NormalisedRect
  padding: number
  skin?: boolean
  anchors: Anchor[]
}

export interface FigureDescriptor {
  schemaVersion: number
  taxonomyVersion: number
  id: string
  name: string
  canvas: { width: number; height: number }
  skinTonePart: string | null
  skeleton: null
  parts: FigurePartDescriptor[]
}
