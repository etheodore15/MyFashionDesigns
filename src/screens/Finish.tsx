import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { useEditor } from '../store/editor'
import { listBackdrops, listFrames } from '../packs/loader'
import { IconButton } from '../components/ui'
import type { FigureAdapter } from '../figure'
import { getFigureAdapter } from '../figure'
import { composeDesign } from '../drawing/compose'

/** S9 Finish: name it, sign it, frame it (S3 folded in here). */
export default function Finish() {
  const design = useEditor((s) => s.design)
  const updateDesign = useEditor((s) => s.updateDesign)
  const navigate = useApp((s) => s.navigate)
  const [adapter, setAdapter] = useState<FigureAdapter | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!design) return
    let alive = true
    void getFigureAdapter(design.figureId).then((a) => { if (alive) setAdapter(a) })
    return () => { alive = false }
  }, [design?.figureId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!adapter || !design) return
    const canvas = composeDesign(adapter, design, { width: 300, includeBackdrop: true, includeFrame: true })
    setPreview(canvas.toDataURL('image/png'))
  }, [adapter, design])

  if (!design) return null

  return (
    <div className="fixed inset-0 bg-paper flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="flex items-center">
        <IconButton icon="⬅️" label="Back to drawing" onClick={() => navigate('board')} />
        <h1 className="flex-1 text-center text-2xl font-bold font-round select-none">Finish your look 🎀</h1>
        <div className="w-12" />
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
        {preview && (
          <img src={preview} alt="design preview" className="w-44 md:w-56 rounded-2xl shadow-lg bg-white" />
        )}

        <div className="flex flex-col gap-4 w-full max-w-sm">
          <label className="flex flex-col gap-1">
            <span className="font-round text-ink/60 text-sm">Design name</span>
            <input
              value={design.name}
              onChange={(e) => updateDesign({ name: e.target.value })}
              placeholder="My amazing look"
              maxLength={40}
              className="min-h-12 rounded-2xl border-2 border-ink/15 px-4 bg-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-round text-ink/60 text-sm">Caption</span>
            <input
              value={design.frame.caption}
              onChange={(e) => updateDesign({ frame: { ...design.frame, caption: e.target.value } })}
              placeholder="Ready for the runway…"
              maxLength={60}
              className="min-h-12 rounded-2xl border-2 border-ink/15 px-4 bg-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-round text-ink/60 text-sm">Designed by</span>
            <input
              value={design.frame.designerName}
              onChange={(e) => updateDesign({ frame: { ...design.frame, designerName: e.target.value } })}
              placeholder="Your name"
              maxLength={30}
              className="min-h-12 rounded-2xl border-2 border-ink/15 px-4 bg-white"
            />
          </label>

          <div>
            <span className="font-round text-ink/60 text-sm">Frame</span>
            <div className="flex gap-2 mt-1">
              {listFrames().map((f) => (
                <button
                  key={f.id} type="button"
                  onClick={() => updateDesign({ frame: { ...design.frame, style: f.id as 'none' | 'plain' | 'sketchbook' } })}
                  className={`flex-1 min-h-12 rounded-2xl border-2 active:scale-95 font-round
                    ${design.frame.style === f.id ? 'bg-accentSoft border-accent' : 'bg-white border-ink/10'}`}
                >{f.icon} {f.label}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-round text-ink/60 text-sm">Backdrop</span>
            <div className="flex gap-2 mt-1 flex-wrap">
              {listBackdrops().map((b) => (
                <button
                  key={b.id} type="button" aria-label={b.label} title={b.label}
                  onClick={() => updateDesign({ backdrop: { type: b.type, colours: b.colours } })}
                  className={`w-12 h-12 rounded-2xl border-2 active:scale-90
                    ${JSON.stringify(design.backdrop.colours) === JSON.stringify(b.colours) && design.backdrop.type === b.type
                      ? 'ring-4 ring-accent border-white' : 'border-ink/10'}`}
                  style={{
                    background: b.type === 'none' ? 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/12px 12px'
                      : b.type === 'plain' ? b.colours[0]
                        : `linear-gradient(${b.colours.join(',')})`
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('export')}
            className="min-h-14 rounded-3xl bg-accent text-white text-xl font-bold font-round shadow-lg active:scale-95"
          >Show it off! 🌟</button>
        </div>
      </div>
    </div>
  )
}
