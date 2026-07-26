import { useEffect, useRef, type ReactNode } from 'react'

// Icon-first UI, minimum 44pt tap targets (§7 accessibility).

export function IconButton(props: {
  icon: ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  big?: boolean
  className?: string
  dataTut?: string
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      data-tut={props.dataTut}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex items-center justify-center rounded-2xl border-2 select-none
        ${props.big ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-2xl'}
        ${props.active
          ? 'bg-accent text-white border-accent shadow-md'
          : 'bg-white/95 text-ink border-ink/15 shadow-sm'}
        ${props.disabled ? 'opacity-30' : 'active:scale-95'}
        transition-transform ${props.className ?? ''}`}
    >
      {props.icon}
    </button>
  )
}

/**
 * Shows whether a drawing sits in front of or behind the figure: a body
 * shape with a stroke crossing it, drawn over or under. Reads at a glance
 * without words — the app requires no reading (§7).
 */
export function FrontBehindIcon({ behind }: { behind: boolean }) {
  const body = <ellipse cx="12" cy="12" rx="5.5" ry="8" fill="#ddd5cc" stroke="#332d28" strokeWidth="1.6" />
  const mark = <path d="M2.5 12 H21.5" stroke="#e86fa4" strokeWidth="3.4" strokeLinecap="round" />
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden focusable="false">
      {behind ? <>{mark}{body}</> : <>{body}{mark}</>}
    </svg>
  )
}

/**
 * Touch-tap ghost-click guard. On touch devices the tap that OPENS an
 * overlay is followed a few ms later by a synthesized compatibility `click`,
 * hit-tested against whatever is under the finger by then — i.e. the newly
 * mounted overlay. Without this, popups flash open and instantly close (or a
 * button that mounted under the finger gets pressed). We swallow clicks for
 * a short window after mount; overlay dismissal uses pointerdown, which
 * ghost clicks never produce.
 */
export function useGhostClickGuard(active: boolean) {
  const openedAt = useRef(0)
  useEffect(() => {
    if (active) openedAt.current = performance.now()
  }, [active])
  return (e: React.MouseEvent) => {
    if (performance.now() - openedAt.current < 250) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

export function Sheet(props: { open: boolean; onClose: () => void; children: ReactNode; side?: 'bottom' | 'right' }) {
  const guard = useGhostClickGuard(props.open)
  if (!props.open) return null
  const side = props.side ?? 'bottom'
  return (
    <div className="fixed inset-0 z-40" role="dialog" onClickCapture={guard}>
      <div className="absolute inset-0 bg-ink/30" onPointerDown={props.onClose} />
      <div
        className={
          side === 'bottom'
            ? 'absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-xl rounded-t-3xl bg-paper p-4 shadow-2xl max-h-[75%] overflow-y-auto'
            : 'absolute right-0 top-0 bottom-0 w-80 max-w-[85%] bg-paper p-4 shadow-2xl overflow-y-auto'
        }
      >
        {props.children}
      </div>
    </div>
  )
}

export function Modal(props: { open: boolean; onClose: () => void; children: ReactNode }) {
  const guard = useGhostClickGuard(props.open)
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" onClickCapture={guard}>
      <div className="absolute inset-0 bg-ink/40" onPointerDown={props.onClose} />
      <div className="relative bg-paper rounded-3xl p-5 shadow-2xl w-full max-w-sm">{props.children}</div>
    </div>
  )
}
