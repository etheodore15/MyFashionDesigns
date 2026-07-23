import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { useEditor } from '../store/editor'
import { IconButton } from '../components/ui'
import type { FigureAdapter } from '../figure'
import { getFigureAdapter } from '../figure'
import { composeDesign } from '../drawing/compose'
import { isSubscribed } from '../entitlements'
import { tutorialEvent } from '../tutorial/bus'

/**
 * S10 Export (S11 Done folded in): PNG export — transparent or with
 * backdrop — save to device, browser print, system share sheet (§7).
 * Rule 4: everything happens locally; nothing leaves the device unless the
 * child uses the OS share sheet herself.
 */
export default function ExportScreen() {
  const design = useEditor((s) => s.design)
  const navigate = useApp((s) => s.navigate)
  const [adapter, setAdapter] = useState<FigureAdapter | null>(null)
  const [withBackdrop, setWithBackdrop] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const canShareFiles = typeof navigator !== 'undefined' && 'share' in navigator

  useEffect(() => {
    if (!design) return
    let alive = true
    void getFigureAdapter(design.figureId).then((a) => { if (alive) setAdapter(a) })
    return () => { alive = false }
  }, [design?.figureId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!adapter || !design) return
    const canvas = composeDesign(adapter, design, { width: 420, includeBackdrop: withBackdrop, includeFrame: true })
    setPreviewUrl(canvas.toDataURL('image/png'))
  }, [adapter, design, withBackdrop])

  if (!design) return null
  // Entitlement stub call site (§8): export is available to subscribers,
  // and everyone is a subscriber in this build.
  if (!isSubscribed()) return null

  function fullCanvas(): HTMLCanvasElement | null {
    if (!adapter || !design) return null
    return composeDesign(adapter, design, { width: 1024, includeBackdrop: withBackdrop, includeFrame: true })
  }

  function fileName(): string {
    return `${(design?.name || 'my-design').replace(/[^\w\d-]+/g, '-').toLowerCase()}.png`
  }

  function savePng() {
    const canvas = fullCanvas()
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName()
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, 'image/png')
    tutorialEvent('design-exported')
  }

  function print() {
    const canvas = fullCanvas()
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const frame = document.createElement('iframe')
    frame.style.position = 'fixed'
    frame.style.right = '100%'
    document.body.appendChild(frame)
    const doc = frame.contentDocument!
    doc.open()
    doc.write(`<img src="${dataUrl}" style="width:100%" onload="setTimeout(function(){window.print()},60)">`)
    doc.close()
    setTimeout(() => frame.remove(), 60000)
    tutorialEvent('design-exported')
  }

  async function share() {
    const canvas = fullCanvas()
    if (!canvas) return
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], fileName(), { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: design?.name || 'My design' })
      } else {
        await navigator.share({ title: design?.name || 'My design' })
      }
    } catch {
      // user cancelled the share sheet — nothing to do
    }
    tutorialEvent('design-exported')
  }

  return (
    <div className="fixed inset-0 bg-paper flex flex-col p-4 gap-4 overflow-y-auto items-center">
      <div className="w-full flex items-center">
        <IconButton icon="⬅️" label="Back" onClick={() => navigate('finish')} />
        <h1 className="flex-1 text-center text-2xl font-bold font-round select-none">Ta-da! 🎉</h1>
        <div className="w-12" />
      </div>

      {previewUrl && (
        <img src={previewUrl} alt="finished design" className="w-52 sm:w-64 rounded-2xl shadow-xl bg-white" />
      )}

      <button
        type="button"
        onClick={() => setWithBackdrop((b) => !b)}
        className={`min-h-11 px-4 rounded-2xl border-2 font-round text-sm active:scale-95 ${withBackdrop ? 'bg-white border-ink/15' : 'bg-accentSoft border-accent'}`}
      >{withBackdrop ? '🖼 With backdrop' : '⬜ See-through PNG'}</button>

      <div className="flex flex-wrap gap-3 justify-center">
        <button type="button" onClick={savePng}
          className="min-h-14 px-6 rounded-3xl bg-accent text-white text-lg font-bold font-round shadow active:scale-95">
          💾 Save picture
        </button>
        <button type="button" onClick={print}
          className="min-h-14 px-6 rounded-3xl bg-white border-2 border-ink/15 text-lg font-bold font-round shadow active:scale-95">
          🖨 Print
        </button>
        {canShareFiles && (
          <button type="button" onClick={() => void share()}
            className="min-h-14 px-6 rounded-3xl bg-white border-2 border-ink/15 text-lg font-bold font-round shadow active:scale-95">
            📤 Share
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => { useEditor.getState().closeDesign(); navigate('gallery') }}
        className="min-h-12 px-8 rounded-3xl bg-emerald-500 text-white font-bold font-round shadow active:scale-95"
      >✔️ All done</button>
    </div>
  )
}
