import { FrontBehindIcon, IconButton } from './ui'
import { REGION_MIRROR, useEditor } from '../store/editor'

/**
 * S7 Adjust — optional correction only (§5): nudge, resize, layer order,
 * mirror to other side, delete. Wrap is visible but disabled in this build.
 * Only the transform / stack position change; stroke points are never touched.
 */
export default function AdjustPanel() {
  const adjustItemId = useEditor((s) => s.adjustItemId)
  const design = useEditor((s) => s.design)
  const nudge = useEditor((s) => s.nudgeItem)
  const scale = useEditor((s) => s.scaleItem)
  const rotate = useEditor((s) => s.rotateItem)
  const move = useEditor((s) => s.moveItemInStack)
  const del = useEditor((s) => s.deleteItem)
  const mirror = useEditor((s) => s.mirrorItemToOtherSide)
  const setItemBehind = useEditor((s) => s.setItemBehind)
  const close = useEditor((s) => s.setAdjustItem)

  const item = design?.items.find((i) => i.id === adjustItemId)
  if (!item) return null
  const canMirror = Boolean(REGION_MIRROR[item.primaryRegionId])
  const N = 0.01 // nudge step in figure-normalised units

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur rounded-3xl shadow-xl border border-ink/10 p-3 flex flex-col gap-2 items-center max-w-[95vw]">
      <div className="flex gap-2 items-center flex-wrap justify-center">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <IconButton icon="⬆️" label="Nudge up" className="!w-11 !h-11" onClick={() => nudge(item.id, 0, -N / 2)} />
          <span />
          <IconButton icon="⬅️" label="Nudge left" className="!w-11 !h-11" onClick={() => nudge(item.id, -N, 0)} />
          <IconButton icon="⬇️" label="Nudge down" className="!w-11 !h-11" onClick={() => nudge(item.id, 0, N / 2)} />
          <IconButton icon="➡️" label="Nudge right" className="!w-11 !h-11" onClick={() => nudge(item.id, N, 0)} />
        </div>
        <div className="flex flex-col gap-1">
          <IconButton icon="➕" label="Bigger" className="!w-11 !h-11" onClick={() => scale(item.id, 1.08)} />
          <IconButton icon="➖" label="Smaller" className="!w-11 !h-11" onClick={() => scale(item.id, 1 / 1.08)} />
        </div>
        <div className="flex flex-col gap-1">
          <IconButton icon="⟲" label="Rotate left" className="!w-11 !h-11" onClick={() => rotate(item.id, -10)} />
          <IconButton icon="⟳" label="Rotate right" className="!w-11 !h-11" onClick={() => rotate(item.id, 10)} />
        </div>
        <div className="flex flex-col gap-1">
          <IconButton icon="🔼" label="Bring forward" className="!w-11 !h-11" onClick={() => move(item.id, 1)} />
          <IconButton icon="🔽" label="Send back" className="!w-11 !h-11" onClick={() => move(item.id, -1)} />
        </div>
        <IconButton
          icon={<FrontBehindIcon behind={item.behindFigure} />}
          label={item.behindFigure ? 'Behind the figure — tap to move in front' : 'In front of the figure — tap to move behind'}
          active={item.behindFigure}
          onClick={() => setItemBehind(item.id, !item.behindFigure)}
        />
        {canMirror && (
          <IconButton icon="🪞" label="Mirror to other side" onClick={() => mirror(item.id)} />
        )}
        <IconButton icon="🌀" label="Wrap (coming later)" disabled onClick={() => undefined} />
        <IconButton icon="🗑" label="Delete" onClick={() => del(item.id)} />
        <IconButton icon="✔️" label="Done adjusting" onClick={() => close(null)} className="!bg-emerald-500 !border-emerald-500 text-white" />
      </div>
    </div>
  )
}
