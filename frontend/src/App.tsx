import { useEffect, useState } from 'react'
import styles from './App.module.css'
import SymbolGallery from '@/dev/SymbolGallery'

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  if (hash === '#/symbols') return <SymbolGallery />

  return (
    <div className={styles.shell}>
      <header className={styles.top}>Mechanics Sight</header>
      <aside className={styles.palette}>
        <h2 className={styles.title}>Palette</h2>
      </aside>
      <main className={styles.canvas}>
        <h2 className={styles.title}>Beam</h2>
      </main>
      <aside className={styles.inspector}>
        <h2 className={styles.title}>Inspector</h2>
      </aside>
      <footer className={`${styles.status} num`}>x = —</footer>
    </div>
  )
}
