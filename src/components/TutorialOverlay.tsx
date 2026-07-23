import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { editorCanvasApi } from './EditorCanvas'
import type { RegionId } from '../model/types'
import { tutorialEvent } from '../tutorial/bus'

/**
 * T1 tutorial runner overlay. Fully data-driven: renders the current JSON
 * step's prompt + a pulsing highlight over its target. Skip is always
 * available and still unlocks the tools (§6).
 */
export default function TutorialOverlay() {
  const tutorial = useApp((s) => s.activeTutorial)
  const stepIndex = useApp((s) => s.tutorialStep)
  const skip = useApp((s) => s.skipTutorial)
  const [target, setTarget] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const step = tutorial?.steps[stepIndex]

  useEffect(() => {
    if (!step?.target) { setTarget(null); return }
    const locate = () => {
      if (step.target!.type === 'dom') {
        const el = document.querySelector(`[data-tut="${step.target!.key}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          setTarget({ left: r.left, top: r.top, width: r.width, height: r.height })
          return
        }
      } else if (step.target!.type === 'region' && editorCanvasApi.getRegionScreenRect) {
        const r = editorCanvasApi.getRegionScreenRect(step.target!.id as RegionId)
        if (r) { setTarget(r); return }
      }
      setTarget(null)
    }
    locate()
    const iv = setInterval(locate, 350)
    return () => clearInterval(iv)
  }, [step])

  if (!tutorial || !step) return null

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {target && (
        <div
          className="absolute rounded-3xl border-4 border-accent animate-pulse shadow-[0_0_0_6px_rgba(232,111,164,0.25)]"
          style={{
            left: target.left - 8, top: target.top - 8,
            width: target.width + 16, height: target.height + 16
          }}
        />
      )}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur rounded-3xl shadow-xl border-2 border-accentSoft px-4 py-2.5 max-w-[94vw]">
        <span className="text-3xl" aria-hidden>{step.icon}</span>
        <span className="font-round text-ink text-base sm:text-lg">{step.text}</span>
        {step.waitFor.event === 'next' && (
          <button
            type="button"
            onClick={() => tutorialEvent('next')}
            className="ml-1 min-w-11 min-h-11 px-4 rounded-2xl bg-accent text-white text-lg font-bold active:scale-95"
          >▶</button>
        )}
        <button
          type="button"
          aria-label="Skip tutorial"
          onClick={skip}
          className="min-w-11 min-h-11 px-2 rounded-2xl text-ink/50 text-sm active:scale-95"
        >Skip ✕</button>
      </div>
    </div>
  )
}
