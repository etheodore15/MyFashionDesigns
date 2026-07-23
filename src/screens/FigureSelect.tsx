import { useEffect, useRef, useState } from 'react'
import { getFigureAdapter, listFigures } from '../figure'
import { listFigureIds, listSkinTones } from '../packs/loader'
import { useApp } from '../store/app'
import { useEditor } from '../store/editor'
import { IconButton } from '../components/ui'

/** S2 Figure Select: figure, twelve skin tones, mirror toggle (§7). */
export default function FigureSelect() {
  const navigate = useApp((s) => s.navigate)
  const profile = useApp((s) => s.activeProfile())
  const startDesign = useEditor((s) => s.startDesign)
  const figures = listFigures(listFigureIds())
  const tones = listSkinTones()
  const [figureId, setFigureId] = useState(figures[0]?.id ?? '')
  const [tone, setTone] = useState(tones[Math.floor(tones.length / 3)] ?? '#eac198')
  const [mirrored, setMirrored] = useState(false)

  function start() {
    if (!profile || !figureId) return
    startDesign(profile.id, figureId, tone, mirrored)
    navigate('board')
  }

  return (
    <div className="fixed inset-0 bg-paper flex flex-col items-center p-4 gap-5 overflow-y-auto">
      <div className="w-full flex items-center">
        <IconButton icon="⬅️" label="Back" onClick={() => navigate('landing')} />
        <h1 className="flex-1 text-center text-2xl font-bold font-round select-none">Who are you dressing?</h1>
        <div className="w-12" />
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        {figures.map((f) => (
          <FigureCard
            key={f.id} figureId={f.id} name={f.name} tone={tone} mirrored={mirrored}
            selected={figureId === f.id} onSelect={() => setFigureId(f.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center max-w-md">
        {tones.map((t) => (
          <button
            key={t} type="button" aria-label={`skin tone ${t}`}
            onClick={() => setTone(t)}
            className={`w-11 h-11 rounded-full border-2 active:scale-90 transition-transform ${tone === t ? 'ring-4 ring-accent border-white' : 'border-ink/10'}`}
            style={{ background: t }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setMirrored((m) => !m)}
        className={`min-h-12 px-5 rounded-2xl border-2 font-round active:scale-95 ${mirrored ? 'bg-accentSoft border-accent' : 'bg-white border-ink/15'}`}
      >🪞 Mirror figure {mirrored ? 'on' : 'off'}</button>

      <button
        type="button"
        onClick={start}
        disabled={!figureId}
        className="min-h-16 px-12 rounded-3xl bg-accent text-white text-2xl font-bold font-round shadow-lg active:scale-95 disabled:opacity-40"
      >Start drawing! ✏️</button>
    </div>
  )
}

function FigureCard(props: {
  figureId: string; name: string; tone: string; mirrored: boolean
  selected: boolean; onSelect: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    void getFigureAdapter(props.figureId).then((adapter) => {
      if (!alive) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      if (props.mirrored) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      // Thumbnails render through the adapter — no direct asset access.
      const off = document.createElement('canvas')
      off.width = canvas.width
      off.height = canvas.height
      adapter.renderUnderlay(off.getContext('2d')!, props.tone)
      ctx.drawImage(off, 0, 0)
      ctx.restore()
    })
    return () => { alive = false }
  }, [props.figureId, props.tone, props.mirrored])

  return (
    <button
      type="button"
      data-tut="figure-card"
      onClick={props.onSelect}
      className={`flex flex-col items-center gap-2 p-4 rounded-3xl bg-white shadow-md border-4 active:scale-95 transition-transform
        ${props.selected ? 'border-accent' : 'border-transparent'}`}
    >
      <canvas ref={canvasRef} width={160} height={320} className="w-[130px] h-[260px]" aria-hidden />
      <span className="font-round font-bold text-ink">{props.name}</span>
    </button>
  )
}
