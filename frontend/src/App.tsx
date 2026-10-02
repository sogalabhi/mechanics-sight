import { lazy, Suspense, useEffect, useState } from 'react'
import styles from './App.module.css'
import { startLiveAnalysis } from '@/api/live'
import { CanvasStack } from '@/canvas/CanvasStack'
import { XScaleProvider } from '@/canvas/XScaleContext'
import { useMediaQuery } from '@/canvas/useMediaQuery'
import { useWidth } from '@/canvas/useWidth'
import SymbolGallery from '@/dev/SymbolGallery'
import { isLabHash } from '@/lab/steel/share'
import { AddSheet } from '@/panels/AddSheet'
import { Banner } from '@/panels/Banner'
import { Palette } from '@/panels/Palette'
import { RightPane } from '@/panels/RightPane'
import { StatusBar } from '@/panels/StatusBar'
import { TopBar } from '@/panels/TopBar'
import { useShortcuts } from '@/panels/useShortcuts'
import { applyTheme, loadTheme } from '@/model/theme'
import { useStore } from '@/store/store'

const LabShell = lazy(() => import('@/lab/steel/LabShell'))

function Editor() {
  const length = useStore((s) => s.beam.length)
  const [ref, width] = useWidth<HTMLElement>()
  useEffect(() => startLiveAnalysis(), [])
  useEffect(() => applyTheme(loadTheme()), [])
  useShortcuts()
  const paneWidth = useStore((s) => s.paneWidth)
  const phone = useMediaQuery('(max-width: 699px)')
  return (
    <div className={styles.shell} style={{ '--pane-w': `${paneWidth}px` } as React.CSSProperties}>
      <header className={styles.top}><TopBar /></header>
      {!phone && <aside className={styles.palette}><Palette /></aside>}
      <main className={styles.canvas} ref={ref}>
        <XScaleProvider length={length} width={width}>
          <Banner />
          <CanvasStack width={width} />
        </XScaleProvider>
      </main>
      <aside className={styles.pane}><RightPane phone={phone} /></aside>
      {phone && <AddSheet />}
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
  if (isLabHash(hash)) {
    return (
      <Suspense fallback={<p style={{ padding: 16 }}>Loading the lab…</p>}>
        <LabShell />
      </Suspense>
    )
  }
  return hash === '#/symbols' ? <SymbolGallery /> : <Editor />
}
