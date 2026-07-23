import { useEffect, useRef } from 'react'
import type { FigureAdapter } from '../figure'
import { composeDesign } from '../drawing/compose'
import { useEditor } from '../store/editor'

/** Small whole-figure preview kept visible in a corner of the region view so
 *  context is never lost (§5 step 5). */
export default function WholeFigurePreview(props: { adapter: FigureAdapter }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const design = useEditor.getState().design
      const canvas = canvasRef.current
      if (!design || !canvas) return
      const composed = composeDesign(props.adapter, design, { width: 120, includeBackdrop: false })
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(composed, 0, 0, canvas.width, canvas.height)
    }
    draw()
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.design?.items !== prev.design?.items) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(draw)
      }
    })
    return () => { unsub(); cancelAnimationFrame(raf) }
  }, [props.adapter])

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={240}
      className="w-[72px] h-[144px] rounded-xl bg-white/85 shadow-md border border-ink/10 pointer-events-none"
      aria-hidden
    />
  )
}
