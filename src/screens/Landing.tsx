import { useState } from 'react'
import { useApp } from '../store/app'
import { Modal } from '../components/ui'
import ParentalGate from '../components/ParentalGate'
import { ALL_TOOLS } from '../model/factories'

const AVATAR_ICONS = ['🦄', '🐱', '🦊', '🐼', '🐸', '🦋', '🐙', '🦁']
const AVATAR_COLOURS = ['#f7cfe0', '#cfe8ff', '#e2f4e8', '#ffe9c7', '#e6dcff', '#ffd9d2']

/** S1 Landing: pick who's drawing. Icon-first, no reading required. */
export default function Landing() {
  const profiles = useApp((s) => s.profiles)
  const activeProfileId = useApp((s) => s.activeProfileId)
  const selectProfile = useApp((s) => s.selectProfile)
  const addProfile = useApp((s) => s.addProfile)
  const patchProfile = useApp((s) => s.patchProfile)
  const removeProfile = useApp((s) => s.removeProfile)
  const navigate = useApp((s) => s.navigate)
  const [creating, setCreating] = useState(false)
  const [icon, setIcon] = useState(AVATAR_ICONS[0])
  const [colour, setColour] = useState(AVATAR_COLOURS[0])
  const [name, setName] = useState('')
  const [gateOpen, setGateOpen] = useState(false)
  const [grownupsOpen, setGrownupsOpen] = useState(false)

  const active = profiles.find((p) => p.id === activeProfileId) ?? null

  async function create() {
    await addProfile(name.trim() || 'Designer', icon, colour)
    setCreating(false)
    setName('')
  }

  return (
    <div className="fixed inset-0 bg-paper flex flex-col items-center justify-center gap-8 p-6 overflow-y-auto">
      <div className="text-center select-none">
        <div className="text-6xl mb-2" aria-hidden>✏️👗✨</div>
        <h1 className="text-3xl sm:text-4xl font-bold font-round text-ink">Your Drawings Real Life</h1>
        <p className="text-ink/60 font-round mt-1">Draw right on the figure — your design comes to life!</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 max-w-lg">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectProfile(p.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-3xl border-4 min-w-24 active:scale-95 transition-transform
              ${p.id === activeProfileId ? 'border-accent shadow-lg' : 'border-transparent'}`}
            style={{ background: p.avatar.colour }}
          >
            <span className="text-5xl" aria-hidden>{p.avatar.icon}</span>
            <span className="font-round text-ink text-sm">{p.displayName}</span>
            <span className="text-xs" aria-hidden>
              {p.tutorialProgress.completed.map(() => '🏅').join('')}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex flex-col items-center justify-center gap-1 p-3 rounded-3xl border-4 border-dashed border-ink/20 min-w-24 min-h-28 text-ink/50 active:scale-95"
        >
          <span className="text-4xl" aria-hidden>➕</span>
          <span className="font-round text-sm">New designer</span>
        </button>
      </div>

      {active && (
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => navigate('figure-select')}
            className="min-h-16 px-10 rounded-3xl bg-accent text-white text-2xl font-bold font-round shadow-lg active:scale-95"
          >✏️ Draw!</button>
          <button
            type="button"
            onClick={() => navigate('gallery')}
            className="min-h-16 px-10 rounded-3xl bg-white border-2 border-ink/15 text-ink text-2xl font-bold font-round shadow active:scale-95"
          >🗂 My designs</button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setGateOpen(true)}
        className="absolute top-3 right-3 min-w-11 min-h-11 rounded-2xl text-ink/40 text-sm px-3"
      >👨‍👩‍👧 Grown-ups</button>

      {/* New profile */}
      <Modal open={creating} onClose={() => setCreating(false)}>
        <h2 className="text-lg font-bold mb-3">Pick your look!</h2>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {AVATAR_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setIcon(i)}
              className={`text-4xl min-h-14 rounded-2xl ${icon === i ? 'bg-accentSoft ring-4 ring-accent' : 'bg-white'}`}>{i}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-3 justify-center">
          {AVATAR_COLOURS.map((c) => (
            <button key={c} type="button" aria-label={`colour ${c}`} onClick={() => setColour(c)}
              className={`w-11 h-11 rounded-full ${colour === c ? 'ring-4 ring-accent' : ''}`} style={{ background: c }} />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (you can skip this)"
          className="w-full min-h-12 rounded-2xl border-2 border-ink/15 px-4 mb-3 bg-white"
          maxLength={20}
        />
        <button type="button" onClick={() => void create()}
          className="w-full min-h-14 rounded-2xl bg-accent text-white text-xl font-bold active:scale-95">Let's draw! ✏️</button>
      </Modal>

      <ParentalGate open={gateOpen} onClose={() => setGateOpen(false)} onPassed={() => setGrownupsOpen(true)} />

      {/* Grown-ups panel */}
      <Modal open={grownupsOpen} onClose={() => setGrownupsOpen(false)}>
        <h2 className="text-lg font-bold mb-3">Grown-ups</h2>
        {active ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink/60">Profile: {active.avatar.icon} {active.displayName}</p>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-accentSoft font-bold active:scale-95"
              onClick={() => {
                patchProfile(active.id, (p) => ({ ...p, unlockedTools: [...ALL_TOOLS] }))
              }}
            >🔓 Unlock all tools {active.unlockedTools.length >= ALL_TOOLS.length ? '✓' : ''}</button>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-white border-2 border-ink/10 active:scale-95"
              onClick={() => patchProfile(active.id, (p) => ({
                ...p,
                preferences: { ...p.preferences, handedness: p.preferences.handedness === 'right' ? 'left' : 'right' }
              }))}
            >✋ Tool rail: {active.preferences.handedness === 'right' ? 'right side' : 'left side'}</button>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-white border-2 border-ink/10 active:scale-95"
              onClick={() => patchProfile(active.id, (p) => ({
                ...p,
                preferences: { ...p.preferences, contrastMode: !p.preferences.contrastMode }
              }))}
            >🔳 High contrast: {active.preferences.contrastMode ? 'on' : 'off'}</button>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-white border-2 border-ink/10 active:scale-95"
              onClick={() => patchProfile(active.id, (p) => ({
                ...p,
                preferences: { ...p.preferences, hotspotGlow: !p.preferences.hotspotGlow }
              }))}
            >✨ Hotspot glow: {active.preferences.hotspotGlow ? 'on' : 'off'}</button>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-red-50 text-red-600 border-2 border-red-200 active:scale-95"
              onClick={() => { void removeProfile(active.id); setGrownupsOpen(false) }}
            >🗑 Delete this profile and its designs</button>
          </div>
        ) : (
          <p className="text-sm text-ink/60">Select a profile first.</p>
        )}
        <p className="text-xs text-ink/40 mt-4">
          Everything stays on this device. No accounts, no internet needed, nothing is shared.
        </p>
      </Modal>
    </div>
  )
}
