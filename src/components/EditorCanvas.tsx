import { useEffect, useRef } from 'react'
import Konva from 'konva'
import type { FigureAdapter } from '../figure'
import type { Design, Item, NormalisedRect, RegionId } from '../model/types'
import { FIG_H, FIG_W, itemRect, renderItem } from '../drawing/itemRenderer'
import { renderStroke } from '../drawing/strokeRender'
import { shapePoints } from '../drawing/shapes'
import { composeDesign } from '../drawing/compose'
import { createStroke } from '../model/factories'
import { useEditor } from '../store/editor'
import type { Stroke, StrokeTool } from '../model/types'

/** Registry used by the tutorial overlay to highlight regions on screen. */
export const editorCanvasApi: {
  getRegionScreenRect?: (r: RegionId) => { left: number; top: number; width: number; height: number } | null
} = {}

interface Props {
  adapter: FigureAdapter
  onRegionTap: (region: RegionId | null, screen: { x: number; y: number }) => void
  hotspotGlow: boolean
}

const SHAPE_TOOLS: StrokeTool[] = ['line', 'rect', 'ellipse', 'star', 'heart']

export default function EditorCanvas({ adapter, onRegionTap, hotspotGlow }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    stage: Konva.Stage
    world: Konva.Group
    underlayNode: Konva.Image
    underlayCanvas: HTMLCanvasElement
    itemsGroup: Konva.Group
    glowGroup: Konva.Group
    previewNode: Konva.Image
    previewCanvas: HTMLCanvasElement | null
    adjustRect: Konva.Rect
    glowAnim: Konva.Animation | null
    viewAnim: number | null
  } | null>(null)

  // Drawing session state (refs — no re-render per pointermove).
  const drawRef = useRef<{
    pointers: Map<number, { x: number; y: number }>
    stroke: [number, number, number][] | null
    shapeAnchor: [number, number] | null
    rect: NormalisedRect | null
    pinch: { dist: number; scale: number; center: { x: number; y: number } } | null
    tapStart: { x: number; y: number } | null
    raf: number
  }>({ pointers: new Map(), stroke: null, shapeAnchor: null, rect: null, pinch: null, tapStart: null, raf: 0 })

  // ——— Stage construction ———
  useEffect(() => {
    const container = containerRef.current!
    const stage = new Konva.Stage({ container, width: container.clientWidth, height: container.clientHeight })
    const layer = new Konva.Layer({ listening: false })
    const world = new Konva.Group()
    const underlayCanvas = document.createElement('canvas')
    underlayCanvas.width = FIG_W
    underlayCanvas.height = FIG_H
    const underlayNode = new Konva.Image({ image: underlayCanvas, width: FIG_W, height: FIG_H })
    const glowGroup = new Konva.Group()
    const itemsGroup = new Konva.Group()
    const previewNode = new Konva.Image({ visible: false, image: undefined })
    const adjustRect = new Konva.Rect({
      stroke: '#e86fa4', strokeWidth: 6, dash: [18, 12], visible: false, cornerRadius: 12
    })
    world.add(underlayNode, glowGroup, itemsGroup, previewNode, adjustRect)
    layer.add(world)
    stage.add(layer)

    stateRef.current = {
      stage, world, underlayNode, underlayCanvas, itemsGroup, glowGroup,
      previewNode, previewCanvas: null, adjustRect, glowAnim: null, viewAnim: null
    }

    const ro = new ResizeObserver(() => {
      if (!stateRef.current || stateRef.current.stage !== stage) return
      stage.size({ width: container.clientWidth, height: container.clientHeight })
      fitView(false)
    })
    ro.observe(container)

    editorCanvasApi.getRegionScreenRect = (r) => {
      const s = stateRef.current
      if (!s) return null
      try {
        const b = boundsFor(r)
        const mirrored = useEditor.getState().design?.figure.mirrored ?? false
        const vx = mirrored ? FIG_W - (b.x + b.w) * FIG_W : b.x * FIG_W
        const scale = s.stage.scaleX()
        const left = s.stage.x() + vx * scale
        const top = s.stage.y() + b.y * FIG_H * scale
        const box = container.getBoundingClientRect()
        return { left: box.left + left, top: box.top + top, width: b.w * FIG_W * scale, height: b.h * FIG_H * scale }
      } catch {
        return null
      }
    }

    return () => {
      ro.disconnect()
      editorCanvasApi.getRegionScreenRect = undefined
      const s = stateRef.current
      if (s) {
        s.glowAnim?.stop()
        if (s.viewAnim !== null) cancelAnimationFrame(s.viewAnim)
      }
      stateRef.current = null
      stage.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter])

  function boundsFor(r: RegionId): NormalisedRect {
    return adapter.getBounds(r)
  }

  /** The active drawing rect: the active item's region-union rect. */
  function activeRect(): NormalisedRect | null {
    const { design, activeItemId } = useEditor.getState()
    const item = design?.items.find((i) => i.id === activeItemId)
    if (!item) return null
    return itemRect(adapter, item)
  }

  function figToVisualX(x: number): number {
    const mirrored = useEditor.getState().design?.figure.mirrored ?? false
    return mirrored ? 1 - x : x
  }

  /** Fit the view to board (whole figure) or the active region rect. */
  function fitView(animate: boolean) {
    const s = stateRef.current
    if (!s) return
    const { mode } = useEditor.getState()
    const stage = s.stage
    const cw = stage.width()
    const ch = stage.height()
    if (cw < 4 || ch < 4) return

    let rect: NormalisedRect
    let margin: number
    if (mode === 'region') {
      const r = activeRect()
      if (!r) return
      const region = useEditor.getState().activeRegionId
      const pad = region ? adapter.getPadding(region) : 0.06
      rect = { x: r.x - pad, y: r.y - pad / 2, w: r.w + pad * 2, h: r.h + pad }
      margin = 0.92
    } else {
      rect = adapter.getBounds('whole-body')
      rect = { x: rect.x - 0.03, y: rect.y - 0.015, w: rect.w + 0.06, h: rect.h + 0.03 }
      margin = 0.95
    }

    const mirrored = useEditor.getState().design?.figure.mirrored ?? false
    const vxNorm = mirrored ? 1 - (rect.x + rect.w) : rect.x
    const rw = rect.w * FIG_W
    const rh = rect.h * FIG_H
    const scale = Math.min((cw / rw), (ch / rh)) * margin
    const x = (cw - rw * scale) / 2 - vxNorm * FIG_W * scale
    const y = (ch - rh * scale) / 2 - rect.y * FIG_H * scale

    if (s.viewAnim !== null) {
      cancelAnimationFrame(s.viewAnim)
      s.viewAnim = null
    }
    if (animate) {
      // Plain rAF zoom animation (~450ms) — tap→zoom→draw stays well under
      // the three-second acceptance budget (§13).
      const from = { scale: stage.scaleX(), x: stage.x(), y: stage.y() }
      const start = performance.now()
      const DURATION = 450
      const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
      const step = (now: number) => {
        const cur = stateRef.current
        if (!cur || cur.stage !== stage) return
        const t = Math.min(1, (now - start) / DURATION)
        const k = ease(t)
        const sc = from.scale + (scale - from.scale) * k
        stage.scale({ x: sc, y: sc })
        stage.position({ x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k })
        stage.batchDraw()
        cur.viewAnim = t < 1 ? requestAnimationFrame(step) : null
      }
      s.viewAnim = requestAnimationFrame(step)
    } else {
      stage.scale({ x: scale, y: scale })
      stage.position({ x, y })
    }
    stage.batchDraw()
  }

  /** Redraw the figure underlay for the current mode. */
  function renderUnderlay() {
    const s = stateRef.current
    if (!s) return
    const { design, mode, activeRegionId, surround } = useEditor.getState()
    if (!design) return
    const ctx = s.underlayCanvas.getContext('2d')!
    ctx.clearRect(0, 0, FIG_W, FIG_H)
    adapter.setSurroundOpacity?.(surround)
    // Prime the tint with the design's skin tone, then draw for the mode.
    if (mode === 'region' && activeRegionId) {
      adapter.renderUnderlay(ctx, design.figure.skinTone)
      ctx.clearRect(0, 0, FIG_W, FIG_H)
      adapter.renderRegionView(ctx, activeRegionId)
    } else {
      adapter.renderUnderlay(ctx, design.figure.skinTone)
    }
    const mirrored = design.figure.mirrored
    s.world.scaleX(mirrored ? -1 : 1)
    s.world.x(mirrored ? FIG_W : 0)
    s.underlayNode.image(s.underlayCanvas)
    s.stage.batchDraw()
  }

  /** Rebuild/refresh item nodes from the design (array order = layer stack). */
  function syncItems() {
    const s = stateRef.current
    if (!s) return
    const { design, mode, activeItemId } = useEditor.getState()
    if (!design) return
    const seen = new Set<string>()
    design.items.forEach((item, index) => {
      seen.add(item.id)
      let node = s.itemsGroup.findOne<Konva.Image>(`#item-${item.id}`)
      if (!node) {
        node = new Konva.Image({ id: `item-${item.id}`, image: undefined, listening: false })
        s.itemsGroup.add(node)
      }
      const rect = itemRect(adapter, item)
      const rendered = renderItem(item, rect)
      node.image(rendered.canvas)
      node.width(rect.w * FIG_W)
      node.height(rect.h * FIG_H)
      node.offsetX((rect.w * FIG_W) / 2)
      node.offsetY((rect.h * FIG_H) / 2)
      node.x((rect.x + rect.w / 2 + item.transform.x) * FIG_W)
      node.y((rect.y + rect.h / 2 + item.transform.y) * FIG_H)
      node.rotation(item.transform.rotation)
      node.scale({ x: item.transform.scale, y: item.transform.scale })
      node.visible(item.visible)
      node.opacity(mode === 'region' && item.id !== activeItemId ? 0.4 : 1)
      node.zIndex(index)
    })
    for (const node of [...s.itemsGroup.getChildren()]) {
      const id = node.id().replace('item-', '')
      if (!seen.has(id)) node.destroy()
    }
    s.stage.batchDraw()
  }

  /** Drawable-area marker + preview canvas for the active item. */
  function syncRegionSession() {
    const s = stateRef.current
    if (!s) return
    const { mode } = useEditor.getState()
    const rect = mode === 'region' ? activeRect() : null
    if (rect) {
      const rendered = { w: Math.max(2, Math.ceil(rect.w * FIG_W * 2)), h: Math.max(2, Math.ceil(rect.h * FIG_H * 2)) }
      const canvas = document.createElement('canvas')
      canvas.width = rendered.w
      canvas.height = rendered.h
      s.previewCanvas = canvas
      s.previewNode.image(canvas)
      s.previewNode.setAttrs({
        x: rect.x * FIG_W, y: rect.y * FIG_H,
        width: rect.w * FIG_W, height: rect.h * FIG_H, visible: true
      })
      s.adjustRect.setAttrs({
        x: rect.x * FIG_W, y: rect.y * FIG_H,
        width: rect.w * FIG_W, height: rect.h * FIG_H,
        visible: true, stroke: '#e86fa4', opacity: 0.55, strokeWidth: 4 / s.stage.scaleX()
      })
      drawRef.current.rect = rect
    } else {
      s.previewNode.visible(false)
      s.previewCanvas = null
      drawRef.current.rect = null
      syncAdjustMarquee()
    }
    s.stage.batchDraw()
  }

  function syncAdjustMarquee() {
    const s = stateRef.current
    if (!s) return
    const { design, adjustItemId, mode } = useEditor.getState()
    const item = design?.items.find((i) => i.id === adjustItemId)
    if (mode === 'board' && item) {
      const rect = itemRect(adapter, item)
      s.adjustRect.setAttrs({
        x: (rect.x + item.transform.x) * FIG_W,
        y: (rect.y + item.transform.y) * FIG_H,
        width: rect.w * FIG_W, height: rect.h * FIG_H,
        visible: true, opacity: 0.9, strokeWidth: 5 / s.stage.scaleX()
      })
    } else if (mode === 'board') {
      s.adjustRect.visible(false)
    }
    s.stage.batchDraw()
  }

  /** Idle glow hotspots (toggleable). */
  function syncGlow() {
    const s = stateRef.current
    if (!s) return
    const { mode } = useEditor.getState()
    s.glowAnim?.stop()
    s.glowAnim = null
    s.glowGroup.destroyChildren()
    if (mode !== 'board' || !hotspotGlow) { s.stage.batchDraw(); return }
    const regions = adapter.getRegions().filter((r) => r !== 'whole-body' && r !== 'background')
    for (const r of regions) {
      const b = adapter.getBounds(r)
      s.glowGroup.add(new Konva.Ellipse({
        x: (b.x + b.w / 2) * FIG_W, y: (b.y + b.h / 2) * FIG_H,
        radiusX: Math.max(30, (b.w * FIG_W) / 2.6), radiusY: Math.max(30, (b.h * FIG_H) / 2.6),
        fill: '#e86fa4', opacity: 0.10, listening: false
      }))
    }
    s.glowAnim = new Konva.Animation((frame) => {
      const t = (frame?.time ?? 0) / 1000
      const o = 0.06 + 0.06 * (1 + Math.sin(t * 2.2)) / 2
      s.glowGroup.getChildren().forEach((n) => n.opacity(o))
    }, s.glowGroup.getLayer())
    s.glowAnim.start()
    s.stage.batchDraw()
  }

  // ——— Store subscriptions ———
  useEffect(() => {
    renderUnderlay()
    syncItems()
    syncGlow()
    syncRegionSession()
    fitView(false)

    let prevMode = useEditor.getState().mode
    let prevRegionKey = useEditor.getState().activeItemId
    let prevItems = useEditor.getState().design?.items
    let prevSkin = useEditor.getState().design?.figure.skinTone
    let prevMirror = useEditor.getState().design?.figure.mirrored
    let prevSurround = useEditor.getState().surround
    let prevAdjust = useEditor.getState().adjustItemId

    const unsub = useEditor.subscribe((state) => {
      const modeChanged = state.mode !== prevMode
      const regionChanged = state.activeItemId !== prevRegionKey
      const itemsChanged = state.design?.items !== prevItems
      const skinChanged = state.design?.figure.skinTone !== prevSkin
      const mirrorChanged = state.design?.figure.mirrored !== prevMirror
      const surroundChanged = state.surround !== prevSurround
      const adjustChanged = state.adjustItemId !== prevAdjust
      prevMode = state.mode
      prevRegionKey = state.activeItemId
      prevItems = state.design?.items
      prevSkin = state.design?.figure.skinTone
      prevMirror = state.design?.figure.mirrored
      prevSurround = state.surround
      prevAdjust = state.adjustItemId

      if (modeChanged || skinChanged || mirrorChanged || surroundChanged || regionChanged) renderUnderlay()
      if (itemsChanged || modeChanged || regionChanged) syncItems()
      if (modeChanged || regionChanged) { syncRegionSession(); syncGlow() }
      if (adjustChanged || itemsChanged) syncAdjustMarquee()
      if (modeChanged || regionChanged || mirrorChanged) fitView(true)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, hotspotGlow])

  useEffect(() => { syncGlow() }, [hotspotGlow]) // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Pointer handling ———
  useEffect(() => {
    const container = containerRef.current!

    const toFigure = (e: PointerEvent): { x: number; y: number } => {
      const s = stateRef.current!
      const box = container.getBoundingClientRect()
      const pos = { x: e.clientX - box.left, y: e.clientY - box.top }
      const inv = s.world.getAbsoluteTransform().copy().invert()
      const p = inv.point(pos)
      return { x: p.x / FIG_W, y: p.y / FIG_H }
    }

    const renderPreview = () => {
      const s = stateRef.current
      const d = drawRef.current
      if (!s || !s.previewCanvas || !d.rect) return
      const ctx = s.previewCanvas.getContext('2d')!
      ctx.clearRect(0, 0, s.previewCanvas.width, s.previewCanvas.height)
      const state = useEditor.getState()
      const pixelScale = s.previewCanvas.height / (d.rect.h * FIG_H)
      const width = state.strokeWidthFor(d.rect.h)

      const drawOne = (tool: StrokeTool, pts: [number, number, number][]) => {
        const preview: Stroke = createStroke(
          tool === 'eraser' ? 'marker' : tool,
          tool === 'eraser' ? '#faf7f2' : state.colour,
          width,
          tool === 'marker' ? 0.55 : tool === 'eraser' ? 0.9 : 1,
          pts
        )
        renderStroke(ctx, preview, pixelScale)
      }

      if (d.stroke && d.stroke.length > 0) {
        const tool = state.tool
        let pts = d.stroke
        if (SHAPE_TOOLS.includes(tool) && d.shapeAnchor) {
          const last = d.stroke[d.stroke.length - 1]
          pts = shapePoints(tool, d.shapeAnchor, [last[0], last[1]])
        }
        drawOne(state.tool, pts)
        if (state.symmetry && state.tool !== 'fill') {
          drawOne(state.tool, pts.map((p) => [1 - p[0], p[1], p[2]] as [number, number, number]))
        }
      }
      s.stage.batchDraw()
    }

    const toLocal = (fig: { x: number; y: number }): [number, number, number] | null => {
      const rect = drawRef.current.rect
      if (!rect) return null
      const lx = (fig.x - rect.x) / rect.w
      const ly = (fig.y - rect.y) / rect.h
      return [Math.min(1, Math.max(0, lx)), Math.min(1, Math.max(0, ly)), 0.5]
    }

    const insideRect = (fig: { x: number; y: number }, slack = 0.04): boolean => {
      const rect = drawRef.current.rect
      if (!rect) return false
      return fig.x >= rect.x - rect.w * slack && fig.x <= rect.x + rect.w * (1 + slack) &&
        fig.y >= rect.y - rect.h * slack && fig.y <= rect.y + rect.h * (1 + slack)
    }

    const onDown = (e: PointerEvent) => {
      const s = stateRef.current
      if (!s) return
      container.setPointerCapture(e.pointerId)
      const d = drawRef.current
      d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const state = useEditor.getState()

      if (d.pointers.size === 2 && state.mode === 'region') {
        // Second finger: cancel the stroke, start pinch (view transform only).
        d.stroke = null
        d.shapeAnchor = null
        renderPreview()
        const [a, b] = [...d.pointers.values()]
        d.pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          scale: s.stage.scaleX(),
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        }
        return
      }
      if (d.pointers.size > 1) return

      const fig = toFigure(e)
      if (state.mode === 'board') {
        d.tapStart = { x: e.clientX, y: e.clientY }
        return
      }
      // Region mode. Any pointer-down starts a stroke; points are clamped to
      // the drawable region rect so the child always gets visible feedback —
      // ink lands at the box edge instead of silently vanishing. (The dimmed
      // surround stays non-drawable, §5.)
      if (state.eyedropper) return // handled on tap-up
      if (state.tool === 'fill') return // handled on tap-up
      const p = toLocal(fig)
      if (!p) return
      if (SHAPE_TOOLS.includes(state.tool)) {
        d.shapeAnchor = [p[0], p[1]]
        d.stroke = [p]
      } else {
        d.stroke = [p]
      }
      renderPreview()
    }

    const onMove = (e: PointerEvent) => {
      const s = stateRef.current
      const d = drawRef.current
      if (!s) return
      if (!d.pointers.has(e.pointerId)) return
      d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (d.pinch && d.pointers.size >= 2) {
        const [a, b] = [...d.pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const factor = dist / Math.max(1, d.pinch.dist)
        const newScale = Math.min(d.pinch.scale * 8, Math.max(d.pinch.scale * 0.5, d.pinch.scale * factor))
        const box = container.getBoundingClientRect()
        const cx = d.pinch.center.x - box.left
        const cy = d.pinch.center.y - box.top
        const oldScale = s.stage.scaleX()
        const world = { x: (cx - s.stage.x()) / oldScale, y: (cy - s.stage.y()) / oldScale }
        s.stage.scale({ x: newScale, y: newScale })
        s.stage.position({
          x: (center.x - box.left) - world.x * newScale,
          y: (center.y - box.top) - world.y * newScale
        })
        s.stage.batchDraw()
        return
      }

      if (d.stroke) {
        const fig = toFigure(e)
        const p = toLocal(fig)
        if (!p) return
        const last = d.stroke[d.stroke.length - 1]
        if (SHAPE_TOOLS.includes(useEditor.getState().tool)) {
          d.stroke.push(p)
        } else if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004) {
          d.stroke.push(p)
        }
        if (!d.raf) {
          d.raf = requestAnimationFrame(() => { d.raf = 0; renderPreview() })
        }
      }
    }

    const onUp = (e: PointerEvent) => {
      const d = drawRef.current
      const state = useEditor.getState()
      const start = d.pointers.get(e.pointerId)
      d.pointers.delete(e.pointerId)
      if (d.pinch) {
        if (d.pointers.size < 2) d.pinch = null
        return
      }

      if (state.mode === 'board') {
        if (d.tapStart && start && Math.hypot(e.clientX - d.tapStart.x, e.clientY - d.tapStart.y) < 10) {
          const fig = toFigure(e)
          const region = adapter.hitTest(fig.x, fig.y)
          onRegionTap(region, { x: e.clientX, y: e.clientY })
        }
        d.tapStart = null
        return
      }

      // Region mode taps: eyedropper / fill.
      const fig = toFigure(e)
      if (state.eyedropper) {
        const design = state.design
        if (design) {
          const sample = sampleColour(adapter, design, fig)
          if (sample) state.setColour(sample)
        }
        state.setEyedropper(false)
        return
      }
      if (state.tool === 'fill') {
        if (insideRect(fig, 0.05)) {
          const p = toLocal(fig)
          if (p) state.addStroke([p], 'fill', state.strokeWidthFor(drawRef.current.rect?.h ?? 1))
        }
        return
      }

      // Commit the in-progress stroke.
      if (d.stroke && d.stroke.length > 0) {
        let pts = d.stroke
        const rect = d.rect
        if (SHAPE_TOOLS.includes(state.tool) && d.shapeAnchor) {
          const last = d.stroke[d.stroke.length - 1]
          pts = shapePoints(state.tool, d.shapeAnchor, [last[0], last[1]])
        }
        if (rect) state.addStroke(pts, undefined, state.strokeWidthFor(rect.h))
      }
      d.stroke = null
      d.shapeAnchor = null
      renderPreview()
    }

    container.addEventListener('pointerdown', onDown)
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerup', onUp)
    container.addEventListener('pointercancel', onUp)
    return () => {
      container.removeEventListener('pointerdown', onDown)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerup', onUp)
      container.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, onRegionTap])

  return <div ref={containerRef} className="absolute inset-0 touch-none" />
}

/** Eyedropper: sample the composited design at a figure-space point. */
function sampleColour(adapter: FigureAdapter, design: Design, fig: { x: number; y: number }): string | null {
  if (fig.x < 0 || fig.x > 1 || fig.y < 0 || fig.y > 1) return null
  const canvas = composeDesign(adapter, design, { width: 256, includeBackdrop: true })
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const vx = design.figure.mirrored ? 1 - fig.x : fig.x
  const d = ctx.getImageData(
    Math.min(canvas.width - 1, Math.floor(vx * canvas.width)),
    Math.min(canvas.height - 1, Math.floor(fig.y * canvas.height)), 1, 1).data
  if (d[3] < 16) return null
  return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export type { Item }
