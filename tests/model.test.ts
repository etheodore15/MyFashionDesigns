// Model invariants + the "Adjust never rewrites stroke points" guarantee
// (Build Brief v0.4 §13, Rules 1 & 2).
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db', () => ({
  saveDesign: vi.fn(async () => undefined),
  getDesign: vi.fn(async () => undefined),
  listDesigns: vi.fn(async () => []),
  deleteDesign: vi.fn(async () => undefined),
  listProfiles: vi.fn(async () => []),
  saveProfile: vi.fn(async () => undefined),
  deleteProfile: vi.fn(async () => undefined),
  getMeta: vi.fn(async () => undefined),
  setMeta: vi.fn(async () => undefined)
}))

import { createDesign, createItem, createProfile, normaliseItem } from '../src/model/factories'
import { IDENTITY_TRANSFORM } from '../src/model/types'
import { deformModeFor } from '../src/model/categories'
import { useEditor } from '../src/store/editor'

describe('Item invariants (§4)', () => {
  it('always has a non-empty regionIds array, even single-region', () => {
    const item = createItem('head', 'hair', [], 0)
    expect(Array.isArray(item.regionIds)).toBe(true)
    expect(item.regionIds).toEqual(['head'])
  })

  it('captures deformMode by category', () => {
    expect(deformModeFor('dress')).toBe('follow')
    expect(deformModeFor('hair')).toBe('follow')
    expect(deformModeFor('ring')).toBe('rigid')
    expect(deformModeFor('glasses')).toBe('rigid')
    expect(createItem('hand-left', 'ring', ['hand-left'], 0).deformMode).toBe('rigid')
  })

  it('starts with the identity transform and wrap stored-but-false', () => {
    const item = createItem('torso', 'dress', ['torso', 'waist', 'hips'], 0)
    expect(item.transform).toEqual({ x: 0, y: 0, scale: 1, rotation: 0, wrap: false })
    expect(item.transform).not.toBe(IDENTITY_TRANSFORM) // own mutable copy
  })

  it('multi-region categories record every region they span', () => {
    const item = createItem('torso', 'dress', ['torso', 'waist', 'hips'], 0)
    expect(item.regionIds).toEqual(['torso', 'waist', 'hips'])
    expect(item.primaryRegionId).toBe('torso')
  })
})

describe('In front of / behind the figure', () => {
  it('new items draw in front by default', () => {
    expect(createItem('head', 'hair', [], 0).behindFigure).toBe(false)
  })

  it('normalises designs saved before the field existed', () => {
    const legacy = createItem('head', 'hair', [], 0)
    delete (legacy as Partial<typeof legacy>).behindFigure
    expect(normaliseItem(legacy).behindFigure).toBe(false)
  })

  it('toggles without touching stroke points (Rule 2)', () => {
    const s = useEditor.getState()
    s.startDesign('p1', 'mannequin-tpose', '#eac198', false)
    s.startItem('head', { id: 'hair', label: 'Hair', icon: '💇' })
    s.addStroke([[0.3, 0.2, 0.5], [0.7, 0.8, 0.5]])
    const item = useEditor.getState().design!.items[0]
    const before = JSON.stringify(item.strokes.map((st) => st.points))

    s.setItemBehind(item.id, true)
    let after = useEditor.getState().design!.items.find((i) => i.id === item.id)!
    expect(after.behindFigure).toBe(true)
    expect(JSON.stringify(after.strokes.map((st) => st.points))).toBe(before)

    s.setItemBehind(item.id, false)
    after = useEditor.getState().design!.items.find((i) => i.id === item.id)!
    expect(after.behindFigure).toBe(false)
    expect(JSON.stringify(after.strokes.map((st) => st.points))).toBe(before)
  })
})

describe('Profile factory', () => {
  it('never locks free drawing (§6 rule 1)', () => {
    const p = createProfile('Test', '🦄', '#fff')
    expect(p.unlockedTools).toContain('pencil')
    expect(p.unlockedTools).toContain('eraser')
    expect(p.unlockedTools).toContain('colour')
    expect(p.unlockedTools).toContain('export')
  })
})

describe('Adjust operations never touch stroke points (Rule 2 / §13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  function setup() {
    const s = useEditor.getState()
    s.startDesign('profile-1', 'mannequin-tpose', '#eac198', false)
    s.startItem('torso', { id: 'dress', label: 'Dress', icon: '👗', regions: ['torso', 'waist', 'hips'] })
    s.addStroke([[0.1, 0.1, 0.5], [0.42, 0.37, 0.5], [0.9, 0.88, 0.5]])
    s.addStroke([[0.5, 0.2, 0.5], [0.55, 0.6, 0.5]], 'marker', 0.004)
    return useEditor.getState().design!.items[0]
  }

  it('nudge / resize / rotate / reorder leave points byte-identical', () => {
    const item = setup()
    const before = JSON.stringify(item.strokes.map((st) => st.points))
    const s = useEditor.getState()
    s.nudgeItem(item.id, 0.05, -0.02)
    s.scaleItem(item.id, 1.4)
    s.rotateItem(item.id, 25)
    s.moveItemInStack(item.id, 1)
    const after = useEditor.getState().design!.items.find((i) => i.id === item.id)!
    expect(JSON.stringify(after.strokes.map((st) => st.points))).toBe(before)
    expect(after.transform.x).toBeCloseTo(0.05)
    expect(after.transform.scale).toBeCloseTo(1.4)
    expect(after.transform.rotation).toBe(25)
  })

  it('undo restores the previous items array', () => {
    const item = setup()
    const strokesBefore = useEditor.getState().design!.items[0].strokes.length
    useEditor.getState().addStroke([[0.2, 0.2, 0.5], [0.3, 0.3, 0.5]])
    expect(useEditor.getState().design!.items.find((i) => i.id === item.id)!.strokes.length).toBe(strokesBefore + 1)
    useEditor.getState().undo()
    expect(useEditor.getState().design!.items.find((i) => i.id === item.id)!.strokes.length).toBe(strokesBefore)
    useEditor.getState().redo()
    expect(useEditor.getState().design!.items.find((i) => i.id === item.id)!.strokes.length).toBe(strokesBefore + 1)
  })

  it('mirror to other side creates a NEW item and leaves the original untouched', () => {
    const s = useEditor.getState()
    s.startDesign('profile-1', 'mannequin-tpose', '#eac198', false)
    s.startItem('hand-left', { id: 'ring', label: 'Ring', icon: '💍' })
    s.addStroke([[0.2, 0.4, 0.5], [0.6, 0.5, 0.5]])
    const original = useEditor.getState().design!.items[0]
    const before = JSON.stringify(original.strokes.map((st) => st.points))
    s.mirrorItemToOtherSide(original.id)
    const design = useEditor.getState().design!
    expect(design.items).toHaveLength(2)
    const after = design.items.find((i) => i.id === original.id)!
    const copy = design.items.find((i) => i.id !== original.id)!
    expect(JSON.stringify(after.strokes.map((st) => st.points))).toBe(before)
    expect(copy.primaryRegionId).toBe('hand-right')
    expect(copy.strokes[0].points[0][0]).toBeCloseTo(1 - 0.2)
  })

  it('a saved design always satisfies the §13 item invariants', () => {
    setup()
    const design = useEditor.getState().design!
    for (const item of design.items) {
      expect(item.regionIds.length).toBeGreaterThan(0)
      expect(['follow', 'rigid']).toContain(item.deformMode)
      expect(item.transform).toEqual({ x: 0, y: 0, scale: 1, rotation: 0, wrap: false })
    }
  })
})

describe('Design factory', () => {
  it('creates an empty design with figure state and no pose (§4)', () => {
    const d = createDesign('p1', 'bust-form', '#cf9668', true)
    expect(d.figure).toEqual({ pose: null, skinTone: '#cf9668', mirrored: true })
    expect(d.items).toEqual([])
    expect(d.backdrop.type).toBe('none')
    expect(d.frame.style).toBe('none')
  })
})
