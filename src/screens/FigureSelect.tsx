import { useEffect, useRef, useState } from 'react'
import { listFigures, renderFigurePreview } from '../figure'
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
    // The figure grid scrolls; tones and the Start button stay pinned so
    // they are always one tap away however many poses a pack adds.
    <div className="fixed inset-0 bg-paper flex flex-col">
      <div className="w-full flex items-center p-3 pb-1 shrink-0">
        <IconButton icon="⬅️" label="Back" onClick={() => navigate('landing')} />
        <h1 className="flex-1 text-center text-xl sm:text-2xl font-bold font-round select-none">Who are you dressing?</h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 justify-items-center w-full max-w-4xl mx-auto">
          {figures.map((f) => (
            <FigureCard
              key={f.id} figureId={f.id} name={f.name} tone={tone} mirrored={mirrored}
              selected={figureId === f.id} onSelect={() => setFigureId(f.id)}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-center gap-2 p-3 pt-2 bg-paper border-t border-ink/10 shadow-[0_-6px_16px_rgba(0,0,0,0.05)]">
        {/* Every tone must be reachable without scrolling — a row that runs
            off the edge quietly hides the ends of the range. */}
        <div className="grid grid-cols-6 gap-2 justify-items-center">
          {tones.map((t) => (
            <button
              key={t} type="button" aria-label={`skin tone ${t}`}
              onClick={() => setTone(t)}
              className={`w-11 h-11 rounded-full border-2 active:scale-90 transition-transform ${tone === t ? 'ring-4 ring-accent border-white' : 'border-ink/10'}`}
              style={{ background: t }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 w-full max-w-md">
          <button
            type="button"
            aria-label={`Mirror figure ${mirrored ? 'on' : 'off'}`}
            onClick={() => setMirrored((m) => !m)}
            className={`min-h-14 w-14 shrink-0 rounded-2xl border-2 text-2xl active:scale-95 ${mirrored ? 'bg-accentSoft border-accent' : 'bg-white border-ink/15'}`}
          >🪞</button>
          <button
            type="button"
            onClick={start}
            disabled={!figureId}
            className="flex-1 min-h-14 rounded-3xl bg-accent text-white text-xl font-bold font-round shadow-lg active:scale-95 disabled:opacity-40"
          >Start drawing! ✏️</button>
        </div>
      </div>
    </div>
  )
}

function FigureCard(props: {
  figureId: string; name: string; tone: string; mirrored: boolean
  selected: boolean; onSelect: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Thumbnails come from the figure module's lightweight previews, so
    // browsing every pose doesn't decode every figure at full size.
    void renderFigurePreview(canvas, props.figureId, props.tone, props.mirrored)
  }, [props.figureId, props.tone, props.mirrored])

  return (
    <button
      type="button"
      data-tut="figure-card"
      onClick={props.onSelect}
      className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-3xl bg-white shadow-md border-4 active:scale-95 transition-transform w-full
        ${props.selected ? 'border-accent' : 'border-transparent'}`}
    >
      <canvas ref={canvasRef} width={160} height={320} className="w-full max-w-[110px] h-auto aspect-[1/2]" aria-hidden />
      <span className="font-round font-bold text-ink text-xs sm:text-sm text-center leading-tight">{props.name}</span>
    </button>
  )
}
