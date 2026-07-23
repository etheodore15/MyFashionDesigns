import { useEffect, useRef, useState } from 'react'
import { Sheet } from './ui'
import { useEditor } from '../store/editor'
import { listSwatches } from '../packs/loader'
import { useApp } from '../store/app'

const WHEEL = 220

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)]
}

export default function ColourPicker(props: { open: boolean; onClose: () => void }) {
  const colour = useEditor((s) => s.colour)
  const setColour = useEditor((s) => s.setColour)
  const setEyedropper = useEditor((s) => s.setEyedropper)
  const hasColourTool = useApp((s) => s.hasTool('colour'))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [value, setValue] = useState(1)

  useEffect(() => {
    if (!props.open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(WHEEL, WHEEL)
    const r = WHEEL / 2
    for (let y = 0; y < WHEEL; y++) {
      for (let x = 0; x < WHEEL; x++) {
        const dx = x - r
        const dy = y - r
        const dist = Math.hypot(dx, dy) / r
        const i = (y * WHEEL + x) * 4
        if (dist > 1) { img.data[i + 3] = 0; continue }
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
        const [rr, gg, bb] = hsvToRgb(hue, Math.min(1, dist), value)
        img.data[i] = rr; img.data[i + 1] = gg; img.data[i + 2] = bb
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [props.open, value])

  function pick(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const box = canvas.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * WHEEL
    const y = ((e.clientY - box.top) / box.height) * WHEEL
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const d = ctx.getImageData(Math.max(0, Math.min(WHEEL - 1, x)), Math.max(0, Math.min(WHEEL - 1, y)), 1, 1).data
    if (d[3] === 0) return
    setColour(`#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
  }

  if (!hasColourTool) return null

  return (
    <Sheet open={props.open} onClose={props.onClose}>
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="flex items-center gap-4">
          <canvas
            ref={canvasRef}
            width={WHEEL}
            height={WHEEL}
            className="rounded-full touch-none shadow-inner"
            style={{ width: WHEEL, height: WHEEL }}
            onPointerDown={pick}
            onPointerMove={(e) => e.buttons > 0 && pick(e)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full border-4 border-white shadow" style={{ background: colour }} aria-label="current colour" />
            <input
              type="range" min={0.15} max={1} step={0.01} value={value}
              aria-label="brightness"
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-28 rotate-0 accent-accent"
            />
            <button
              type="button"
              aria-label="eyedropper"
              className="w-12 h-12 rounded-2xl bg-white border-2 border-ink/15 text-2xl active:scale-95"
              onClick={() => { setEyedropper(true); props.onClose() }}
            >💧</button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {listSwatches().map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`colour ${c}`}
              onClick={() => { setColour(c) }}
              className={`w-11 h-11 rounded-full border-2 active:scale-90 transition-transform ${colour === c ? 'border-ink scale-110' : 'border-ink/10'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </Sheet>
  )
}
