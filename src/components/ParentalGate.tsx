import { useRef, useState } from 'react'
import { Modal } from './ui'

/**
 * Simple grown-up gate: press and hold for 3 seconds. Guards the
 * unlock-everything and profile-management panel (§6 rule 3).
 */
export default function ParentalGate(props: { open: boolean; onClose: () => void; onPassed: () => void }) {
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    stop()
    const began = performance.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - began) / 3000)
      setProgress(p)
      if (p >= 1) {
        stop()
        props.onPassed()
        props.onClose()
      }
    }, 50)
  }

  function stop() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setProgress(0)
  }

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <h2 className="text-lg font-bold mb-1">Grown-ups only</h2>
      <p className="text-ink/70 mb-4 text-sm">Press and hold the button for three seconds.</p>
      <button
        type="button"
        className="relative w-full h-16 rounded-2xl bg-accentSoft overflow-hidden border-2 border-accent select-none touch-none"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        <div className="absolute inset-y-0 left-0 bg-accent transition-none" style={{ width: `${progress * 100}%` }} />
        <span className="relative font-bold text-ink">HOLD</span>
      </button>
      <button type="button" onClick={props.onClose} className="mt-3 w-full min-h-11 rounded-2xl text-ink/60">Cancel</button>
    </Modal>
  )
}
