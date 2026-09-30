import { addItem } from '@/model/actions'
import { useStore } from '@/store/store'
import { ENTRIES } from './paletteEntries'
import styles from './panels.module.css'

export function Palette() {
  const beam = useStore((s) => s.beam)
  const commit = useStore((s) => s.commit)
  return (
    <div>
      {ENTRIES.map((g) => (
        <section key={g.group}>
          <h2 className={styles.title}>{g.group}</h2>
          {g.items.map((it) => (
            <button
              key={it.kind}
              className={styles.entry}
              onClick={() => {
                const r = addItem(beam, it.kind)
                commit(r.beam, r.id)
              }}
            >
              <svg width={28} height={28} viewBox={it.box} preserveAspectRatio="xMidYMid meet" aria-hidden>
                {it.art}
              </svg>
              <span>{it.name}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
