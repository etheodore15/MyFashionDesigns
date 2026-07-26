import { useState } from 'react'
import { Sheet, IconButton, FrontBehindIcon } from './ui'
import { useEditor } from '../store/editor'
import { REGION_CATEGORIES } from '../model/categories'

function categoryIcon(category: string): string {
  for (const defs of Object.values(REGION_CATEGORIES)) {
    const hit = defs.find((d) => d.id === category)
    if (hit) return hit.icon
  }
  return '✏️'
}

/** S4 layers panel: drag-reorder, hide, delete (§7). Top of list = front. */
export default function LayersPanel(props: { open: boolean; onClose: () => void }) {
  const design = useEditor((s) => s.design)
  const reorderItem = useEditor((s) => s.reorderItem)
  const toggleVisible = useEditor((s) => s.toggleItemVisible)
  const deleteItem = useEditor((s) => s.deleteItem)
  const setItemBehind = useEditor((s) => s.setItemBehind)
  const setAdjustItem = useEditor((s) => s.setAdjustItem)
  const editItem = useEditor((s) => s.editItem)
  const [dragId, setDragId] = useState<string | null>(null)

  if (!design) return null
  const items = [...design.items].reverse() // front-most first

  function displayToArrayIndex(displayIndex: number): number {
    return design!.items.length - 1 - displayIndex
  }

  return (
    <Sheet open={props.open} onClose={props.onClose} side="right">
      <h2 className="text-lg font-bold mb-3 select-none">🥞 Layers</h2>
      {items.length === 0 && <p className="text-ink/60">Nothing here yet — draw something!</p>}
      <ul className="flex flex-col gap-2">
        {items.map((item, di) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId && dragId !== item.id) reorderItem(dragId, displayToArrayIndex(di))
              setDragId(null)
            }}
            className={`flex items-center gap-2 p-2 rounded-2xl border-2 bg-white
              ${dragId === item.id ? 'opacity-50' : ''} border-ink/10`}
          >
            <span className="text-xl cursor-grab select-none" aria-hidden>⠿</span>
            <button
              type="button"
              className="flex-1 flex items-center gap-2 text-left min-h-11"
              onClick={() => { props.onClose(); editItem(item.id) }}
            >
              <span className="text-2xl">{categoryIcon(item.category)}</span>
              <span className="capitalize text-sm text-ink/70">{item.category} · {item.primaryRegionId}</span>
            </button>
            <IconButton
              icon={<FrontBehindIcon behind={item.behindFigure} />}
              label={item.behindFigure ? 'Behind the figure' : 'In front of the figure'}
              active={item.behindFigure}
              onClick={() => setItemBehind(item.id, !item.behindFigure)} className="!w-11 !h-11"
            />
            <IconButton
              icon={item.visible ? '👁' : '🚫'} label={item.visible ? 'Hide' : 'Show'}
              onClick={() => toggleVisible(item.id)} className="!w-11 !h-11"
            />
            <IconButton
              icon="🎛" label="Adjust"
              onClick={() => { props.onClose(); setAdjustItem(item.id) }} className="!w-11 !h-11"
            />
            <IconButton icon="🗑" label="Delete" onClick={() => deleteItem(item.id)} className="!w-11 !h-11" />
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
