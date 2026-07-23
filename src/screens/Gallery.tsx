import { useEffect, useState } from 'react'
import { useApp } from '../store/app'
import { useEditor } from '../store/editor'
import { deleteDesign, listDesigns, saveDesign } from '../db'
import type { Design } from '../model/types'
import { uid } from '../model/factories'
import { IconButton, Modal } from '../components/ui'
import { maxSavedDesigns } from '../entitlements'

/** S12 My Designs: grid — open, duplicate, rename, delete (§7). */
export default function Gallery() {
  const navigate = useApp((s) => s.navigate)
  const profile = useApp((s) => s.activeProfile())
  const openDesign = useEditor((s) => s.openDesign)
  const [designs, setDesigns] = useState<Design[]>([])
  const [renaming, setRenaming] = useState<Design | null>(null)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Design | null>(null)

  async function refresh() {
    if (!profile) return
    setDesigns(await listDesigns(profile.id))
  }

  useEffect(() => { void refresh() }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Entitlement stub call site (§8): unlimited in this build.
  const canAddMore = designs.length < maxSavedDesigns()

  async function duplicate(d: Design) {
    const copy: Design = structuredClone(d)
    copy.id = uid()
    copy.name = d.name ? `${d.name} copy` : 'Copy'
    copy.created = Date.now()
    copy.modified = Date.now()
    await saveDesign(copy)
    await refresh()
  }

  return (
    <div className="fixed inset-0 bg-paper flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="flex items-center">
        <IconButton icon="🏠" label="Home" onClick={() => navigate('landing')} />
        <h1 className="flex-1 text-center text-2xl font-bold font-round select-none">My Designs 🗂</h1>
        <div className="w-12" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-4xl mx-auto w-full">
        {canAddMore && (
          <button
            type="button"
            onClick={() => navigate('figure-select')}
            className="aspect-[1/2] max-h-72 rounded-3xl border-4 border-dashed border-ink/20 flex flex-col items-center justify-center text-ink/50 bg-white/50 active:scale-95"
          >
            <span className="text-5xl" aria-hidden>➕</span>
            <span className="font-round mt-1">New design</span>
          </button>
        )}
        {designs.map((d) => (
          <div key={d.id} className="flex flex-col rounded-3xl bg-white shadow-md overflow-hidden">
            <button
              type="button"
              className="flex-1 active:scale-[0.98]"
              onClick={() => { openDesign(d); navigate('board') }}
            >
              {d.thumbnail ? (
                <img src={d.thumbnail} alt={d.name || 'design'} className="w-full aspect-[1/2] max-h-60 object-contain bg-paper" />
              ) : (
                <div className="w-full aspect-[1/2] max-h-60 flex items-center justify-center text-4xl bg-paper">🧵</div>
              )}
            </button>
            <div className="p-2">
              <div className="font-round text-sm text-ink truncate text-center">{d.name || 'My design'}</div>
              <div className="flex justify-center gap-1 mt-1">
                <IconButton icon="✏️" label="Rename" className="!w-11 !h-11 !text-lg"
                  onClick={() => { setRenaming(d); setNewName(d.name) }} />
                <IconButton icon="🧬" label="Duplicate" className="!w-11 !h-11 !text-lg" onClick={() => void duplicate(d)} />
                <IconButton icon="🗑" label="Delete" className="!w-11 !h-11 !text-lg" onClick={() => setConfirmDelete(d)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {designs.length === 0 && (
        <p className="text-center text-ink/50 font-round">No designs yet — tap ➕ to make your first one!</p>
      )}

      <Modal open={renaming !== null} onClose={() => setRenaming(null)}>
        <h2 className="text-lg font-bold mb-3">Rename design</h2>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          className="w-full min-h-12 rounded-2xl border-2 border-ink/15 px-4 mb-3 bg-white"
        />
        <button
          type="button"
          className="w-full min-h-12 rounded-2xl bg-accent text-white font-bold active:scale-95"
          onClick={() => {
            if (renaming) {
              void saveDesign({ ...renaming, name: newName, modified: Date.now() }).then(refresh)
            }
            setRenaming(null)
          }}
        >Save</button>
      </Modal>

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <h2 className="text-lg font-bold mb-3">Delete this design?</h2>
        <p className="text-ink/60 mb-4">It will be gone for good.</p>
        <div className="flex gap-2">
          <button type="button" className="flex-1 min-h-12 rounded-2xl bg-white border-2 border-ink/15 active:scale-95"
            onClick={() => setConfirmDelete(null)}>Keep it</button>
          <button type="button" className="flex-1 min-h-12 rounded-2xl bg-red-500 text-white font-bold active:scale-95"
            onClick={() => {
              if (confirmDelete) void deleteDesign(confirmDelete.id).then(refresh)
              setConfirmDelete(null)
            }}>Delete 🗑</button>
        </div>
      </Modal>
    </div>
  )
}
