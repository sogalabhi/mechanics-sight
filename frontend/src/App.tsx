import styles from './App.module.css'

export default function App() {
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
