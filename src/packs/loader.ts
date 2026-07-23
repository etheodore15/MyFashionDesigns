// Pack loader (§9). All non-figure assets — swatches, skin tones, frames,
// backdrops, tutorials, and the LIST of figures — come from pack manifests.
// Nothing is hardcoded anywhere else; this module is the only path to pack
// content. Figure pixel/descriptor assets themselves are read exclusively by
// the figure adapter (Rule 3) — this loader only hands out figure ids.
//
// Rule 4: no network. Packs are bundled and loaded via import.meta.glob,
// never fetched.

export interface FrameDef { id: string; label: string; icon: string }
export interface BackdropDef { id: string; type: 'none' | 'plain' | 'gradient'; label: string; colours: string[] }

export interface TutorialStep {
  id: string
  icon: string
  text: string
  target?: { type: 'dom'; key: string } | { type: 'region'; id: string }
  waitFor: { event: string; region?: string; count?: number }
}

export interface TutorialDef {
  id: string
  title: string
  badge: string
  order: number
  requires: string | null
  unlocksTools: string[]
  unlocksTutorial: string | null
  steps: TutorialStep[]
}

export interface PackManifest {
  id: string
  name: string
  free: boolean
  figures: string[]
  skinTones: string[]
  swatches: string[]
  frames: FrameDef[]
  backdrops: BackdropDef[]
  tutorials: string[]
}

const manifestModules = import.meta.glob('./*/manifest.json', { eager: true }) as
  Record<string, { default: PackManifest }>
const tutorialModules = import.meta.glob('./*/tutorials/*.json', { eager: true }) as
  Record<string, { default: TutorialDef }>

const packs: PackManifest[] = Object.values(manifestModules).map((m) => m.default)
const tutorials: TutorialDef[] = Object.values(tutorialModules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order)

export function listPacks(): PackManifest[] {
  return packs
}

export function listFigureIds(): string[] {
  return packs.flatMap((p) => p.figures)
}

export function listSkinTones(): string[] {
  return packs.flatMap((p) => p.skinTones)
}

export function listSwatches(): string[] {
  return packs.flatMap((p) => p.swatches)
}

export function listFrames(): FrameDef[] {
  return packs.flatMap((p) => p.frames)
}

export function listBackdrops(): BackdropDef[] {
  return packs.flatMap((p) => p.backdrops)
}

export function listTutorials(): TutorialDef[] {
  const ids = new Set(packs.flatMap((p) => p.tutorials))
  return tutorials.filter((t) => ids.has(t.id))
}

export function getTutorial(id: string): TutorialDef | undefined {
  return tutorials.find((t) => t.id === id)
}
