import { useState } from 'react'
import { FrontBehindIcon, IconButton } from './ui'
import { useEditor } from '../store/editor'
import { useApp } from '../store/app'
import type { StrokeTool } from '../model/types'

// S6 tool rail. Tools appear as tutorials unlock them (§7); the rail sits on
// the left or right per the handedness preference (§7 accessibility).

const SHAPES: { kind: StrokeTool; icon: string; label: string }[] = [
  { kind: 'line', icon: '╱', label: 'Line' },
  { kind: 'rect', icon: '▭', label: 'Rectangle' },
  { kind: 'ellipse', icon: '◯', label: 'Circle' },
  { kind: 'star', icon: '⭐', label: 'Star' },
  { kind: 'heart', icon: '❤', label: 'Heart' }
]

export default function ToolRail(props: { onOpenColour: () => void; onDone: () => void; onCollapse: () => void }) {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const colour = useEditor((s) => s.colour)
  const widthChoice = useEditor((s) => s.widthChoice)
  const setWidthChoice = useEditor((s) => s.setWidthChoice)
  const symmetry = useEditor((s) => s.symmetry)
  const setSymmetry = useEditor((s) => s.setSymmetry)
  const surround = useEditor((s) => s.surround)
  const setSurround = useEditor((s) => s.setSurround)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.undoStack.length > 0)
  const canRedo = useEditor((s) => s.redoStack.length > 0)
  const clearItem = useEditor((s) => s.clearActiveItem)
  const hasTool = useApp((s) => s.hasTool)
  const activeItemId = useEditor((s) => s.activeItemId)
  const behind = useEditor((s) => s.design?.items.find((i) => i.id === s.activeItemId)?.behindFigure ?? false)
  const setItemBehind = useEditor((s) => s.setItemBehind)
  const [shapesOpen, setShapesOpen] = useState(false)

  const isShape = SHAPES.some((s) => s.kind === tool)

  return (
    <div className="flex flex-col gap-2 items-center py-2 px-1.5 bg-white/85 backdrop-blur rounded-3xl shadow-lg border border-ink/10 max-h-full overflow-y-auto">
      <IconButton icon="⇥" label="Tuck toolbar away" onClick={props.onCollapse} className="!h-8 !text-base opacity-60" />
      <IconButton icon="✏️" label="Pencil" active={tool === 'pencil'} onClick={() => setTool('pencil')} />
      {hasTool('marker') && (
        <IconButton icon="🖊️" label="Marker" active={tool === 'marker'} onClick={() => setTool('marker')} />
      )}
      <IconButton icon="🧼" label="Eraser" active={tool === 'eraser'} onClick={() => setTool('eraser')} />
      {hasTool('fill') && (
        <IconButton icon="🪣" label="Fill" active={tool === 'fill'} onClick={() => setTool('fill')} />
      )}
      {hasTool('shapes') && (
        <div className="relative">
          <IconButton icon="⬟" label="Shapes" active={isShape} onClick={() => setShapesOpen((o) => !o)} />
          {shapesOpen && (
            <div className="absolute top-0 right-full mr-2 flex gap-1.5 bg-white rounded-2xl p-1.5 shadow-xl border border-ink/10">
              {SHAPES.map((s) => (
                <IconButton
                  key={s.kind} icon={s.icon} label={s.label} active={tool === s.kind}
                  onClick={() => { setTool(s.kind); setShapesOpen(false) }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {hasTool('symmetry') && (
        <IconButton icon="🦋" label="Symmetry" active={symmetry} onClick={() => setSymmetry(!symmetry)} />
      )}

      <button
        type="button"
        aria-label="colour"
        onClick={props.onOpenColour}
        className="w-12 h-12 rounded-full border-4 border-white shadow-md active:scale-95"
        style={{ background: colour }}
      />
      <IconButton
        icon={widthChoice === 'S' ? '·' : widthChoice === 'M' ? '•' : '⬤'}
        label={`Line width ${widthChoice}`}
        onClick={() => setWidthChoice(widthChoice === 'S' ? 'M' : widthChoice === 'M' ? 'L' : 'S')}
      />

      {/* In front of / behind the figure — switchable at any time. */}
      <IconButton
        icon={<FrontBehindIcon behind={behind} />}
        label={behind ? 'Drawing behind the figure — tap to draw in front' : 'Drawing in front of the figure — tap to draw behind'}
        active={behind}
        onClick={() => activeItemId && setItemBehind(activeItemId, !behind)}
      />

      <div className="h-px w-8 bg-ink/15 my-0.5" />
      <IconButton icon="↩️" label="Undo" disabled={!canUndo} onClick={undo} />
      <IconButton icon="↪️" label="Redo" disabled={!canRedo} onClick={redo} />
      <IconButton icon="🗑" label="Clear" onClick={clearItem} />
      <IconButton
        icon={surround >= 0.2 ? '👻' : surround > 0 ? '🌫' : '⬜'}
        label="Surround visibility"
        onClick={() => setSurround(surround >= 0.2 ? 0.08 : surround > 0 ? 0 : 0.25)}
      />
      <div className="h-px w-8 bg-ink/15 my-0.5" />
      <IconButton icon="✔️" label="Done" big dataTut="region-done" onClick={props.onDone} className="!bg-emerald-500 !border-emerald-500 text-white" />
    </div>
  )
}
