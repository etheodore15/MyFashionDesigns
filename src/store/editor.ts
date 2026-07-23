import { create } from 'zustand'
import type { Design, Item, RegionId, Stroke, StrokeTool } from '../model/types'
import { createDesign, createItem, createStroke, uid } from '../model/factories'
import type { CategoryDef } from '../model/categories'
import { saveDesign } from '../db'
import { tutorialEvent } from '../tutorial/bus'

export type WidthChoice = 'S' | 'M' | 'L'

const WIDTH_BASE: Record<WidthChoice, number> = { S: 0.0018, M: 0.0035, L: 0.0068 }
const MAX_UNDO = 100

/** Mirror pairs for "Mirror to other side" (S7). */
export const REGION_MIRROR: Partial<Record<RegionId, RegionId>> = {
  'arm-left': 'arm-right', 'arm-right': 'arm-left',
  'hand-left': 'hand-right', 'hand-right': 'hand-left',
  'foot-left': 'foot-right', 'foot-right': 'foot-left'
}

interface EditorState {
  design: Design | null
  mode: 'board' | 'region'
  activeRegionId: RegionId | null
  activeItemId: string | null
  /** S5 options sheet open for a region. */
  optionsRegion: RegionId | null
  /** S7 adjust target. */
  adjustItemId: string | null
  layersOpen: boolean

  tool: StrokeTool
  colour: string
  widthChoice: WidthChoice
  symmetry: boolean
  eyedropper: boolean
  /** Region-view surround opacity (25% / faint / off) — view preference. */
  surround: number

  undoStack: Item[][]
  redoStack: Item[][]

  startDesign(profileId: string, figureId: string, skinTone: string, mirrored: boolean): Design
  openDesign(design: Design): void
  closeDesign(): void
  updateDesign(patch: Partial<Design>): void

  openOptions(region: RegionId | null): void
  startItem(region: RegionId, category: CategoryDef): void
  editItem(itemId: string): void
  finishRegion(): void
  setAdjustItem(id: string | null): void
  setLayersOpen(open: boolean): void

  setTool(tool: StrokeTool): void
  setColour(colour: string): void
  setWidthChoice(w: WidthChoice): void
  setSymmetry(on: boolean): void
  setEyedropper(on: boolean): void
  setSurround(o: number): void
  /** Stroke width (fraction of ref height) for the active item rect. */
  strokeWidthFor(rectH: number): number

  addStroke(points: [number, number, number][], tool?: StrokeTool, width?: number): void
  undo(): void
  redo(): void
  clearActiveItem(): void

  nudgeItem(id: string, dx: number, dy: number): void
  scaleItem(id: string, factor: number): void
  rotateItem(id: string, degrees: number): void
  moveItemInStack(id: string, dir: 1 | -1): void
  reorderItem(id: string, toIndex: number): void
  toggleItemVisible(id: string): void
  deleteItem(id: string): void
  mirrorItemToOtherSide(id: string): void

  setThumbnail(dataUrl: string): void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist(design: Design | null) {
  if (!design) return
  if (saveTimer) clearTimeout(saveTimer)
  const snapshot = design
  saveTimer = setTimeout(() => { void saveDesign(snapshot) }, 600)
}

export const useEditor = create<EditorState>((set, get) => {
  /** Immutable design update + debounced persistence. */
  function mutate(fn: (d: Design) => Design, pushUndo = false) {
    const { design, undoStack } = get()
    if (!design) return
    const next = { ...fn(design), modified: Date.now() }
    set({
      design: next,
      ...(pushUndo
        ? { undoStack: [...undoStack.slice(-MAX_UNDO + 1), design.items], redoStack: [] }
        : {})
    })
    persist(next)
  }

  function mutateItem(id: string, fn: (item: Item) => Item, pushUndo = true) {
    mutate((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? fn(it) : it)) }), pushUndo)
  }

  return {
    design: null,
    mode: 'board',
    activeRegionId: null,
    activeItemId: null,
    optionsRegion: null,
    adjustItemId: null,
    layersOpen: false,
    tool: 'pencil',
    colour: '#2b2b2b',
    widthChoice: 'M',
    symmetry: false,
    eyedropper: false,
    surround: 0.25,

    undoStack: [],
    redoStack: [],

    startDesign(profileId, figureId, skinTone, mirrored) {
      const design = createDesign(profileId, figureId, skinTone, mirrored)
      set({
        design, mode: 'board', activeRegionId: null, activeItemId: null,
        optionsRegion: null, adjustItemId: null, layersOpen: false,
        undoStack: [], redoStack: []
      })
      persist(design)
      return design
    },

    openDesign(design) {
      set({
        design, mode: 'board', activeRegionId: null, activeItemId: null,
        optionsRegion: null, adjustItemId: null, layersOpen: false,
        undoStack: [], redoStack: []
      })
    },

    closeDesign() {
      const { design } = get()
      if (design) {
        if (saveTimer) clearTimeout(saveTimer)
        void saveDesign(design)
      }
      set({ design: null, mode: 'board', activeRegionId: null, activeItemId: null })
    },

    updateDesign(patch) {
      mutate((d) => ({ ...d, ...patch }))
    },

    openOptions(region) {
      set({ optionsRegion: region })
    },

    startItem(region, category) {
      const { design } = get()
      if (!design) return
      const regions = (category.regions ?? [region]) as RegionId[]
      const item = createItem(region, category.id, regions, design.items.length)
      mutate((d) => {
        const items = [...d.items]
        // insert keeping zIndex bands so new garments slot under accessories
        let at = items.length
        for (let i = 0; i < items.length; i++) {
          if (items[i].zIndex > item.zIndex) { at = i; break }
        }
        items.splice(at, 0, item)
        return { ...d, items }
      }, true)
      set({
        mode: 'region', activeRegionId: region, activeItemId: item.id,
        optionsRegion: null, adjustItemId: null
      })
      tutorialEvent('item-created', { region, category: category.id })
    },

    editItem(itemId) {
      const { design } = get()
      const item = design?.items.find((i) => i.id === itemId)
      if (!item) return
      // Tapping a filled region reopens its strokes, fully editable, forever (§5).
      set({
        mode: 'region', activeRegionId: item.primaryRegionId, activeItemId: itemId,
        optionsRegion: null, adjustItemId: null
      })
      tutorialEvent('region-opened', { region: item.primaryRegionId })
    },

    finishRegion() {
      const { activeItemId } = get()
      // Drop items that ended up with no strokes at all.
      mutate((d) => ({
        ...d,
        items: d.items.filter((it) => it.id !== activeItemId || it.strokes.length > 0)
      }))
      set({ mode: 'board', activeRegionId: null, activeItemId: null, eyedropper: false })
      tutorialEvent('item-finished', {})
    },

    setAdjustItem(id) { set({ adjustItemId: id }) },
    setLayersOpen(open) {
      set({ layersOpen: open })
      if (open) tutorialEvent('layers-opened', {})
    },

    setTool(tool) { set({ tool, eyedropper: false }) },
    setColour(colour) {
      set({ colour, eyedropper: false })
      tutorialEvent('colour-picked', { colour })
    },
    setWidthChoice(widthChoice) { set({ widthChoice }) },
    setSymmetry(symmetry) { set({ symmetry }) },
    setEyedropper(eyedropper) { set({ eyedropper }) },
    setSurround(surround) { set({ surround }) },

    strokeWidthFor(rectH) {
      const base = WIDTH_BASE[get().widthChoice]
      return base * (0.25 + 0.75 * Math.min(1, rectH))
    },

    addStroke(points, tool, width) {
      const { activeItemId, colour, symmetry } = get()
      const useTool = tool ?? get().tool
      if (!activeItemId || points.length === 0) return
      const opacity = useTool === 'marker' ? 0.55 : 1
      const w = width ?? WIDTH_BASE[get().widthChoice]
      const strokes: Stroke[] = [createStroke(useTool, colour, w, opacity, points)]
      if (symmetry && useTool !== 'fill') {
        const mirrored = points.map((p) => [1 - p[0], p[1], p[2]] as [number, number, number])
        strokes.push(createStroke(useTool, colour, w, opacity, mirrored))
      }
      mutateItem(activeItemId, (it) => ({ ...it, strokes: [...it.strokes, ...strokes] }))
      tutorialEvent('stroke-added', { tool: useTool })
    },

    undo() {
      const { design, undoStack, redoStack } = get()
      if (!design || undoStack.length === 0) return
      const items = undoStack[undoStack.length - 1]
      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack.slice(-MAX_UNDO + 1), design.items]
      })
      mutate((d) => ({ ...d, items }))
    },

    redo() {
      const { design, undoStack, redoStack } = get()
      if (!design || redoStack.length === 0) return
      const items = redoStack[redoStack.length - 1]
      set({
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack.slice(-MAX_UNDO + 1), design.items]
      })
      mutate((d) => ({ ...d, items }))
    },

    clearActiveItem() {
      const { activeItemId } = get()
      if (!activeItemId) return
      mutateItem(activeItemId, (it) => ({ ...it, strokes: [] }))
    },

    // ——— S7 Adjust: only the transform object changes; stroke points are
    // never touched (Rule 2, acceptance §13). ———
    nudgeItem(id, dx, dy) {
      mutateItem(id, (it) => ({ ...it, transform: { ...it.transform, x: it.transform.x + dx, y: it.transform.y + dy } }))
    },
    scaleItem(id, factor) {
      mutateItem(id, (it) => ({
        ...it,
        transform: { ...it.transform, scale: Math.min(3, Math.max(0.3, it.transform.scale * factor)) }
      }))
    },
    rotateItem(id, degrees) {
      mutateItem(id, (it) => ({ ...it, transform: { ...it.transform, rotation: it.transform.rotation + degrees } }))
    },

    moveItemInStack(id, dir) {
      mutate((d) => {
        const idx = d.items.findIndex((i) => i.id === id)
        const to = idx + dir
        if (idx < 0 || to < 0 || to >= d.items.length) return d
        const items = [...d.items]
        const [it] = items.splice(idx, 1)
        items.splice(to, 0, it)
        return { ...d, items }
      }, true)
    },

    reorderItem(id, toIndex) {
      mutate((d) => {
        const idx = d.items.findIndex((i) => i.id === id)
        if (idx < 0) return d
        const items = [...d.items]
        const [it] = items.splice(idx, 1)
        items.splice(Math.min(Math.max(0, toIndex), items.length), 0, it)
        return { ...d, items }
      }, true)
    },

    toggleItemVisible(id) {
      mutateItem(id, (it) => ({ ...it, visible: !it.visible }))
    },

    deleteItem(id) {
      mutate((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }), true)
      if (get().adjustItemId === id) set({ adjustItemId: null })
      if (get().activeItemId === id) set({ activeItemId: null, mode: 'board', activeRegionId: null })
    },

    mirrorItemToOtherSide(id) {
      const { design } = get()
      const item = design?.items.find((i) => i.id === id)
      if (!design || !item) return
      const pair = REGION_MIRROR[item.primaryRegionId]
      if (!pair) return
      // A NEW item is created for the other side; the original's strokes are
      // untouched. The copy's flipped points are its own canonical data.
      const copy: Item = {
        ...item,
        id: uid(),
        primaryRegionId: pair,
        regionIds: item.regionIds.map((r) => REGION_MIRROR[r] ?? r),
        transform: { ...item.transform },
        strokes: item.strokes.map((s) => ({
          ...s,
          id: uid(),
          points: s.points.map((p) => [1 - p[0], p[1], p[2]] as [number, number, number])
        }))
      }
      mutate((d) => {
        const idx = d.items.findIndex((i) => i.id === id)
        const items = [...d.items]
        items.splice(idx + 1, 0, copy)
        return { ...d, items }
      }, true)
      tutorialEvent('item-mirrored', {})
    },

    setThumbnail(dataUrl) {
      mutate((d) => ({ ...d, thumbnail: dataUrl }))
    }
  }
})
