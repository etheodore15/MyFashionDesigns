import type { Design, Item, Preferences, Profile, RegionId, Stroke, StrokeTool } from './types'
import { IDENTITY_TRANSFORM } from './types'
import { deformModeFor, defaultZBand } from './categories'

export const uid = (): string =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`)

export const DEFAULT_PREFERENCES: Preferences = {
  handedness: 'right',
  simpleMode: false,
  guideOpacity: 0.25,
  contrastMode: false,
  hotspotGlow: true
}

/**
 * Free drawing is never locked (§6): the core act — pencil, eraser, colour —
 * plus everything needed to reach an export are available from the first
 * second. Tutorials and the parental gate unlock the extras.
 */
export const STARTER_TOOLS: Profile['unlockedTools'] =
  ['pencil', 'marker', 'eraser', 'colour', 'swatches', 'frames', 'backdrops', 'export', 'print']

export const ALL_TOOLS: Profile['unlockedTools'] =
  [...STARTER_TOOLS, 'layers', 'mirror', 'fill', 'harmony', 'shapes', 'symmetry']

export function createProfile(displayName: string, icon: string, colour: string): Profile {
  return {
    id: uid(),
    displayName,
    avatar: { icon, colour },
    tutorialProgress: { completed: [], skipped: [] },
    unlockedTools: [...STARTER_TOOLS],
    preferences: { ...DEFAULT_PREFERENCES },
    created: Date.now()
  }
}

export function createDesign(profileId: string, figureId: string, skinTone: string, mirrored: boolean): Design {
  const now = Date.now()
  return {
    id: uid(),
    profileId,
    name: '',
    created: now,
    modified: now,
    thumbnail: null,
    figureId,
    figure: { pose: null, skinTone, mirrored },
    backdrop: { type: 'none', colours: [] },
    frame: { style: 'none', caption: '', designerName: '' },
    items: []
  }
}

/**
 * Items always carry a non-empty regionIds array, a deformMode, and an
 * identity transform until Adjust is used (§4, §5, acceptance §13).
 */
export function createItem(primaryRegionId: RegionId, category: string, regionIds: RegionId[], zTop: number): Item {
  const regions = regionIds.length ? [...new Set([primaryRegionId, ...regionIds])] : [primaryRegionId]
  return {
    id: uid(),
    regionIds: regions,
    primaryRegionId,
    category,
    deformMode: deformModeFor(category),
    transform: { ...IDENTITY_TRANSFORM },
    zIndex: defaultZBand(category) * 1000 + zTop,
    visible: true,
    locked: false,
    strokes: []
  }
}

export function createStroke(tool: StrokeTool, colour: string, width: number, opacity: number, points: [number, number, number][]): Stroke {
  return { id: uid(), tool, colour, width, opacity, points }
}
