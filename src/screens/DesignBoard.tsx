import { useCallback, useEffect, useRef, useState } from 'react'
import type { FigureAdapter } from '../figure'
import { getFigureAdapter } from '../figure'
import type { RegionId } from '../model/types'
import { REGION_CATEGORIES } from '../model/categories'
import EditorCanvas from '../components/EditorCanvas'
import ToolRail from '../components/ToolRail'
import ColourPicker from '../components/ColourPicker'
import LayersPanel from '../components/LayersPanel'
import AdjustPanel from '../components/AdjustPanel'
import WholeFigurePreview from '../components/WholeFigurePreview'
import { IconButton, Sheet, useGhostClickGuard } from './../components/ui'
import { useEditor } from '../store/editor'
import { useApp } from '../store/app'
import { composeDesign } from '../drawing/compose'
import { tutorialEvent } from '../tutorial/bus'

interface Popover {
  region: RegionId
  x: number
  y: number
}

/** S4 Design Board + S6 Region View + S5 Options + S7 Adjust. */
export default function DesignBoard() {
  const design = useEditor((s) => s.design)
  const mode = useEditor((s) => s.mode)
  const optionsRegion = useEditor((s) => s.optionsRegion)
  const openOptions = useEditor((s) => s.openOptions)
  const startItem = useEditor((s) => s.startItem)
  const editItem = useEditor((s) => s.editItem)
  const finishRegion = useEditor((s) => s.finishRegion)
  const setAdjustItem = useEditor((s) => s.setAdjustItem)
  const layersOpen = useEditor((s) => s.layersOpen)
  const setLayersOpen = useEditor((s) => s.setLayersOpen)
  const setThumbnail = useEditor((s) => s.setThumbnail)
  const navigate = useApp((s) => s.navigate)
  const hasTool = useApp((s) => s.hasTool)
  const profile = useApp((s) => s.activeProfile())
  const activeTutorial = useApp((s) => s.activeTutorial)
  const startTutorial = useApp((s) => s.startTutorial)

  const [adapter, setAdapter] = useState<FigureAdapter | null>(null)
  const [popover, setPopover] = useState<Popover | null>(null)
  const popoverGuard = useGhostClickGuard(popover !== null)
  const [colourOpen, setColourOpen] = useState(false)
  const [railTucked, setRailTucked] = useState(false)
  const [tutorialOffer, setTutorialOffer] = useState<string | null>(null)
  const offeredRef = useRef(false)

  useEffect(() => {
    if (!design) return
    let alive = true
    void getFigureAdapter(design.figureId).then((a) => {
      if (!alive) return
      setAdapter(a)
      // Geometry-aware editing (mirroring across an uneven pose) needs it too.
      useEditor.getState().setAdapter(a)
    })
    return () => { alive = false }
  }, [design?.figureId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Offer the next tutorial once per board visit (skippable in one tap; the
  // ladder never blocks free drawing, §6).
  useEffect(() => {
    if (!profile || offeredRef.current || activeTutorial) return
    const next = useApp.getState().nextTutorialFor(profile)
    if (next) {
      setTutorialOffer(next.id)
      offeredRef.current = true
    }
  }, [profile, activeTutorial])

  // Refresh the gallery thumbnail whenever a region session ends.
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'region' && mode === 'board' && adapter && design) {
      const canvas = composeDesign(adapter, design, { width: 220, includeBackdrop: true })
      setThumbnail(canvas.toDataURL('image/png'))
    }
    prevMode.current = mode
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRegionTap = useCallback((region: RegionId | null, screen: { x: number; y: number }) => {
    if (!region) { setPopover(null); return }
    const state = useEditor.getState()
    const itemsHere = state.design?.items.filter((i) => i.regionIds.includes(region)) ?? []
    tutorialEvent('region-opened', { region })
    if (itemsHere.length === 0) {
      state.openOptions(region)
    } else {
      setPopover({ region, x: screen.x, y: screen.y })
    }
  }, [])

  if (!design) return null

  const categories = optionsRegion ? REGION_CATEGORIES[optionsRegion] : []
  const handedness = profile?.preferences.handedness ?? 'right'
  const popoverItems = popover
    ? design.items.filter((i) => i.regionIds.includes(popover.region))
    : []

  function saveAndExit(to: 'gallery' | 'finish') {
    if (adapter && design) {
      const canvas = composeDesign(adapter, design, { width: 220, includeBackdrop: true })
      setThumbnail(canvas.toDataURL('image/png'))
    }
    navigate(to === 'gallery' ? 'gallery' : 'finish')
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-2 z-30">
        {mode === 'board' ? (
          <>
            <IconButton
              icon="🏠" label="My designs"
              onClick={() => {
                if (adapter && design) {
                  setThumbnail(composeDesign(adapter, design, { width: 220, includeBackdrop: true }).toDataURL('image/png'))
                }
                useEditor.getState().closeDesign()
                navigate('gallery')
              }}
            />
            <div className="flex-1 text-center font-round text-ink/70 select-none truncate">
              {design.name || 'My design'}
            </div>
            <IconButton icon="🧍" label="Whole outfit" onClick={() => openOptions('whole-body')} />
            <IconButton icon="🖼" label="Background drawing" onClick={() => openOptions('background')} />
            {hasTool('layers') && (
              <IconButton icon="🥞" label="Layers" dataTut="layers-btn" onClick={() => setLayersOpen(true)} />
            )}
            <IconButton icon="🎀" label="Finish" dataTut="finish-btn" onClick={() => saveAndExit('finish')} className="!bg-accent !border-accent text-white" />
          </>
        ) : (
          <div className="flex-1 text-center font-round text-ink/60 select-none py-1">
            Draw right on the figure! Pinch to zoom in closer ✨
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative flex-1">
        {adapter ? (
          <EditorCanvas
            adapter={adapter}
            onRegionTap={onRegionTap}
            hotspotGlow={(profile?.preferences.hotspotGlow ?? true) && mode === 'board'}
            insetLeft={mode === 'region' && !railTucked && handedness === 'left' ? 84 : 0}
            insetRight={mode === 'region' && !railTucked && handedness === 'right' ? 84 : 0}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pulse">🧵</div>
        )}

        {/* S6 overlays. The canvas reserves an inset for the rail so it never
            covers the region being drawn; it can also be tucked away fully. */}
        {mode === 'region' && adapter && (
          <>
            {!railTucked ? (
              <div className={`absolute top-2 bottom-2 ${handedness === 'right' ? 'right-2' : 'left-2'} z-20 flex items-center`}>
                <ToolRail
                  onOpenColour={() => setColourOpen(true)}
                  onDone={finishRegion}
                  onCollapse={() => setRailTucked(true)}
                />
              </div>
            ) : (
              <button
                type="button"
                aria-label="Show toolbar"
                onClick={() => setRailTucked(false)}
                className={`absolute top-1/2 -translate-y-1/2 ${handedness === 'right' ? 'right-0 rounded-l-2xl' : 'left-0 rounded-r-2xl'} z-20 bg-accent text-white w-8 h-16 shadow-lg text-lg`}
              >{handedness === 'right' ? '⏴' : '⏵'}</button>
            )}
            <div className={`absolute top-2 ${handedness === 'right' ? 'left-2' : 'right-2'} z-10`}>
              <WholeFigurePreview adapter={adapter} />
            </div>
          </>
        )}

        {/* S4 hint */}
        {mode === 'board' && design.items.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 rounded-3xl px-5 py-2.5 shadow-md text-ink/70 font-round select-none pointer-events-none">
            👆 Tap the figure to start drawing!
          </div>
        )}

        {/* S7 adjust */}
        {mode === 'board' && <AdjustPanel />}
      </div>

      {/* Region popover: existing items or new drawing */}
      {popover && (
        <div className="fixed inset-0 z-40" onClickCapture={popoverGuard} onPointerDown={() => setPopover(null)}>
          <div
            className="absolute bg-white rounded-3xl shadow-2xl border border-ink/10 p-2 flex flex-col gap-1.5 min-w-44"
            style={{
              left: Math.min(popover.x, window.innerWidth - 200),
              top: Math.min(popover.y, window.innerHeight - 90 - popoverItems.length * 56)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex items-center gap-2 min-h-12 px-3 rounded-2xl bg-accentSoft font-bold active:scale-95"
              onClick={() => { setPopover(null); openOptions(popover.region) }}
            >✨ New drawing</button>
            {popoverItems.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex-1 flex items-center gap-2 min-h-12 px-3 rounded-2xl bg-paper active:scale-95 capitalize"
                  onClick={() => { setPopover(null); editItem(item.id) }}
                >✏️ {item.category}</button>
                <IconButton
                  icon="🎛" label="Adjust" className="!w-11 !h-11"
                  onClick={() => { setPopover(null); setAdjustItem(item.id) }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* S5 Options: category menu for the tapped region */}
      <Sheet open={optionsRegion !== null} onClose={() => openOptions(null)}>
        {optionsRegion && (
          <div>
            <h2 className="text-lg font-bold mb-3 capitalize select-none">
              {optionsRegion === 'whole-body' ? '🧍 Whole outfit' : optionsRegion === 'background' ? '🖼 Background' : `What goes here?`}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-tut={`category-${cat.id}`}
                  className="flex items-center gap-3 min-h-14 px-4 rounded-2xl bg-white border-2 border-ink/10 shadow-sm active:scale-95 transition-transform"
                  onClick={() => startItem(optionsRegion, cat)}
                >
                  <span className="text-3xl" aria-hidden>{cat.icon}</span>
                  <span className="font-round">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Tutorial offer banner */}
      {tutorialOffer && !activeTutorial && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 rounded-3xl shadow-xl border-2 border-accentSoft px-4 py-2">
          <span className="text-2xl" aria-hidden>🎓</span>
          <button
            type="button"
            className="min-h-11 px-3 rounded-2xl bg-accent text-white font-bold active:scale-95"
            onClick={() => { startTutorial(tutorialOffer); setTutorialOffer(null) }}
          >Show me!</button>
          <button
            type="button"
            className="min-h-11 px-2 text-ink/50"
            onClick={() => setTutorialOffer(null)}
          >Not now</button>
        </div>
      )}

      <ColourPicker open={colourOpen} onClose={() => setColourOpen(false)} />
      <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
    </div>
  )
}
