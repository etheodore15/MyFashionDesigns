import { useEffect } from 'react'
import { useApp } from './store/app'
import Landing from './screens/Landing'
import FigureSelect from './screens/FigureSelect'
import DesignBoard from './screens/DesignBoard'
import Finish from './screens/Finish'
import ExportScreen from './screens/ExportScreen'
import Gallery from './screens/Gallery'
import TutorialOverlay from './components/TutorialOverlay'

export default function App() {
  const booted = useApp((s) => s.booted)
  const screen = useApp((s) => s.screen)
  const boot = useApp((s) => s.boot)
  const profile = useApp((s) => s.activeProfile())

  useEffect(() => { void boot() }, [boot])

  useEffect(() => {
    document.documentElement.classList.toggle('contrast-high', profile?.preferences.contrastMode ?? false)
  }, [profile?.preferences.contrastMode])

  if (!booted) {
    return (
      <div className="fixed inset-0 bg-paper flex items-center justify-center text-5xl animate-pulse">✏️</div>
    )
  }

  return (
    <>
      {screen === 'landing' && <Landing />}
      {screen === 'figure-select' && <FigureSelect />}
      {screen === 'board' && <DesignBoard />}
      {screen === 'finish' && <Finish />}
      {screen === 'export' && <ExportScreen />}
      {screen === 'gallery' && <Gallery />}
      <TutorialOverlay />
    </>
  )
}
