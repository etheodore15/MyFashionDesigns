import type { ReactNode } from 'react'

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

export function Sheet(props: { open: boolean; onClose: () => void; children: ReactNode; side?: 'bottom' | 'right' }) {
  if (!props.open) return null
  const side = props.side ?? 'bottom'
  return (
    <div className="fixed inset-0 z-40" role="dialog">
      <div className="absolute inset-0 bg-ink/30" onClick={props.onClose} />
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
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="absolute inset-0 bg-ink/40" onClick={props.onClose} />
      <div className="relative bg-paper rounded-3xl p-5 shadow-2xl w-full max-w-sm">{props.children}</div>
    </div>
  )
}
