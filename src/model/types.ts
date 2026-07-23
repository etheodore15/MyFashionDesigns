// Core data model — Build Brief v0.4 §4.
// Rule 1: drawings are vector for life; Stroke.points are the source of truth.
// Rule 2: points live in region-local normalised space permanently; the
// transform object is applied at render time and never baked into points.

/** Frozen, permanent region taxonomy (§3). Sixteen ids. Do not add/rename/reorder. */
export const REGION_TAXONOMY = [
  'head', 'neck', 'shoulders', 'torso', 'waist', 'hips',
  'arm-left', 'arm-right', 'hand-left', 'hand-right',
  'legs-upper', 'legs-lower', 'foot-left', 'foot-right',
  'whole-body', 'background'
] as const

export type RegionId = (typeof REGION_TAXONOMY)[number]

export interface NormalisedRect { x: number; y: number; w: number; h: number }
export interface Anchor { id: 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'neck' | 'waist'; x: number; y: number }

export type StrokeTool =
  | 'pencil' | 'marker' | 'eraser' | 'fill'
  | 'line' | 'rect' | 'ellipse' | 'star' | 'heart'

export interface Stroke {
  id: string
  tool: StrokeTool
  colour: string
  /** Stroke width as a fraction of the reference figure canvas height. */
  width: number
  opacity: number
  /**
   * Points in region-local normalised space (0..1 within the item's region
   * rect — the union of its regions' bounds). [x, y, pressure] tuples.
   * NEVER rewritten after capture (Rule 2).
   */
  points: [number, number, number][]
}

export type DeformMode = 'follow' | 'rigid'

export interface ItemTransform {
  x: number
  y: number
  scale: number
  rotation: number
  /** Stored now, always ignored in this build (§4). */
  wrap: boolean
}

export const IDENTITY_TRANSFORM: Readonly<ItemTransform> =
  Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0, wrap: false })

export interface Item {
  id: string
  /** ALWAYS an array, even for single-region items (§4). */
  regionIds: RegionId[]
  primaryRegionId: RegionId
  category: string
  deformMode: DeformMode
  transform: ItemTransform
  zIndex: number
  visible: boolean
  locked: boolean
  strokes: Stroke[]
}

export interface Backdrop {
  type: 'none' | 'plain' | 'gradient'
  colours: string[]
}

export interface Frame {
  style: 'none' | 'plain' | 'sketchbook'
  caption: string
  designerName: string
}

export interface DesignFigure {
  /** Always null in this build — reserved for rigged figures. */
  pose: null
  skinTone: string
  mirrored: boolean
}

export interface Design {
  id: string
  profileId: string
  name: string
  created: number
  modified: number
  /** PNG data URL thumbnail for the gallery. */
  thumbnail: string | null
  figureId: string
  figure: DesignFigure
  backdrop: Backdrop
  frame: Frame
  /** Ordered array = layer stack. Items render in array order. */
  items: Item[]
}

export type TutorialId = string

export type ToolId =
  | 'pencil' | 'marker' | 'eraser' | 'colour' | 'swatches'
  | 'fill' | 'harmony' | 'shapes' | 'symmetry'
  | 'layers' | 'mirror'
  | 'frames' | 'backdrops' | 'export' | 'print'

export interface Preferences {
  handedness: 'left' | 'right'
  simpleMode: boolean
  /** Region-view surround opacity: 0.25 default, faint, or off. */
  guideOpacity: number
  contrastMode: boolean
  /** Idle glow on region hotspots (S4), toggleable. */
  hotspotGlow: boolean
}

export interface Profile {
  id: string
  displayName: string
  avatar: { icon: string; colour: string }
  tutorialProgress: { completed: TutorialId[]; skipped: TutorialId[] }
  unlockedTools: ToolId[]
  preferences: Preferences
  created: number
}
