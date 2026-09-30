import { useEffect, useState } from 'react'
import styles from './App.module.css'
import { startLiveAnalysis } from '@/api/live'
import { CanvasStack } from '@/canvas/CanvasStack'
import { XScaleProvider } from '@/canvas/XScaleContext'
import { useMediaQuery } from '@/canvas/useMediaQuery'
import { useWidth } from '@/canvas/useWidth'
import SymbolGallery from '@/dev/SymbolGallery'
import { Inspector } from '@/panels/Inspector'
import { AddSheet } from '@/panels/AddSheet'
import { Banner } from '@/panels/Banner'
import { BottomSheet } from '@/panels/BottomSheet'
import { Palette } from '@/panels/Palette'
import { PhysicalProperties } from '@/panels/PhysicalProperties'
import { Results } from '@/panels/Results'
import { StatusBar } from '@/panels/StatusBar'
import { TopBar } from '@/panels/TopBar'
import { useShortcuts } from '@/panels/useShortcuts'
import { applyTheme, loadTheme } from '@/model/theme'
import { useStore } from '@/store/store'

function Editor() {
  const length = useStore((s) => s.beam.length)
  const [ref, width] = useWidth<HTMLElement>()
  useEffect(() => startLiveAnalysis(), [])
  useEffect(() => applyTheme(loadTheme()), [])
  useShortcuts()
  const phone = useMediaQuery('(max-width: 699px)')
  return (
    <div className={styles.shell}>
      <header className={styles.top}><TopBar /></header>
      {!phone && <aside className={styles.palette}><Palette /></aside>}
      <main className={styles.canvas} ref={ref}>
        <XScaleProvider length={length} width={width}>
          <Banner />
          <CanvasStack width={width} />
        </XScaleProvider>
      </main>
      <aside className={styles.inspector}>
        {phone ? (
          <>
            <PhysicalProperties />
            <hr className={styles.hr} />
            <Results />
            <BottomSheet><Inspector compact /></BottomSheet>
            <AddSheet />
          </>
        ) : (
          <>
            <Inspector />
            <hr className={styles.hr} />
            <PhysicalProperties />
            <hr className={styles.hr} />
            <Results />
          </>
        )}
      </aside>
      <footer className={`${styles.status} num`}><StatusBar /></footer>
    </div>
  )
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash === '#/symbols' ? <SymbolGallery /> : <Editor />
}
