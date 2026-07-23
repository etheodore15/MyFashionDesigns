import type { FigureAdapter } from '../figure'
import type { Design } from '../model/types'
import { FIG_H, FIG_W, itemRect, renderItem } from './itemRenderer'

export interface ComposeOptions {
  width?: number
  includeBackdrop?: boolean
  includeFrame?: boolean
}

/**
 * Composites a full design (backdrop → tinted figure underlay → items with
 * their render-time transforms → frame/caption) onto a fresh canvas.
 * Used for the corner preview, gallery thumbnails, the eyedropper and export.
 */
export function composeDesign(adapter: FigureAdapter, design: Design, opts: ComposeOptions = {}): HTMLCanvasElement {
  const figW = opts.width ?? FIG_W
  const figH = figW * 2
  const pad = opts.includeFrame && design.frame.style !== 'none' ? Math.round(figW * 0.06) : 0
  const captionBand = opts.includeFrame && design.frame.style !== 'none' &&
    (design.frame.caption || design.frame.designerName)
    ? Math.round(figW * 0.14) : 0

  const canvas = document.createElement('canvas')
  canvas.width = figW + pad * 2
  canvas.height = figH + pad * 2 + captionBand
  const ctx = canvas.getContext('2d')!

  if (opts.includeFrame && design.frame.style !== 'none') {
    drawFrameBackground(ctx, design.frame.style)
  }

  ctx.save()
  ctx.translate(pad, pad)
  ctx.beginPath()
  ctx.rect(0, 0, figW, figH)
  ctx.clip()

  if (opts.includeBackdrop !== false && design.backdrop.type !== 'none') {
    if (design.backdrop.type === 'plain') {
      ctx.fillStyle = design.backdrop.colours[0] ?? '#ffffff'
      ctx.fillRect(0, 0, figW, figH)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, figH)
      const cols = design.backdrop.colours.length ? design.backdrop.colours : ['#ffffff', '#eeeeee']
      cols.forEach((c, i) => g.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), c))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, figW, figH)
    }
  }

  // Figure + items, optionally mirrored — presentation only, stored points
  // are untouched (Rule 2).
  ctx.save()
  if (design.figure.mirrored) {
    ctx.translate(figW, 0)
    ctx.scale(-1, 1)
  }

  const figCanvas = document.createElement('canvas')
  figCanvas.width = figW
  figCanvas.height = figH
  adapter.renderUnderlay(figCanvas.getContext('2d')!, design.figure.skinTone)
  ctx.drawImage(figCanvas, 0, 0)

  for (const item of design.items) {
    if (!item.visible) continue
    const rect = itemRect(adapter, item)
    const rendered = renderItem(item, rect)
    const t = item.transform
    const cx = (rect.x + rect.w / 2 + t.x) * figW
    const cy = (rect.y + rect.h / 2 + t.y) * figH
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.scale(t.scale, t.scale)
    ctx.drawImage(rendered.canvas, (-rect.w * figW) / 2, (-rect.h * figH) / 2, rect.w * figW, rect.h * figH)
    ctx.restore()
  }
  ctx.restore()
  ctx.restore()

  if (opts.includeFrame && design.frame.style !== 'none') {
    drawFrameBorder(ctx, design, pad, captionBand)
  }

  return canvas
}

function drawFrameBackground(ctx: CanvasRenderingContext2D, style: 'plain' | 'sketchbook') {
  const { width, height } = ctx.canvas
  ctx.fillStyle = style === 'sketchbook' ? '#fbf6e9' : '#ffffff'
  ctx.fillRect(0, 0, width, height)
}

function drawFrameBorder(ctx: CanvasRenderingContext2D, design: Design, pad: number, captionBand: number) {
  const { width, height } = ctx.canvas
  const ink = '#4a4038'
  ctx.save()
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(2, width * 0.004)

  if (design.frame.style === 'plain') {
    ctx.strokeRect(pad * 0.5, pad * 0.5, width - pad, height - pad)
  } else {
    // Sketchbook: double rule + spiral rings along the left edge.
    ctx.strokeRect(pad * 0.45, pad * 0.45, width - pad * 0.9, height - pad * 0.9)
    ctx.setLineDash([width * 0.012, width * 0.009])
    ctx.strokeRect(pad * 0.7, pad * 0.7, width - pad * 1.4, height - pad * 1.4)
    ctx.setLineDash([])
    const rings = 14
    for (let i = 0; i < rings; i++) {
      const y = height * ((i + 0.5) / rings)
      ctx.beginPath()
      ctx.ellipse(pad * 0.45, y, width * 0.012, width * 0.02, 0, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
    }
  }

  if (captionBand > 0) {
    const baseY = height - captionBand / 2
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    if (design.frame.caption) {
      ctx.font = `italic ${Math.round(captionBand * 0.34)}px "Segoe UI", system-ui, sans-serif`
      ctx.fillText(design.frame.caption, width / 2, baseY - captionBand * 0.08, width - pad * 3)
    }
    if (design.frame.designerName) {
      ctx.font = `${Math.round(captionBand * 0.24)}px "Segoe UI", system-ui, sans-serif`
      ctx.fillText(`designed by ${design.frame.designerName}`, width / 2, baseY + captionBand * 0.3, width - pad * 3)
    }
  }
  ctx.restore()
}
