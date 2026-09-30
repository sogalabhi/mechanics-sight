import { useEffect, useState } from 'react'
import { addItem } from '@/model/actions'
import { useStore } from '@/store/store'
import { ENTRIES } from './paletteEntries'
import styles from './panels.module.css'

/** Phone replacement for the palette: a floating Add button and a sheet of large tiles. */
export function AddSheet() {
  const [open, setOpen] = useState(false)
  const selected = useStore((s) => s.selectedId !== null)
  const beam = useStore((s) => s.beam)
  const commit = useStore((s) => s.commit)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (selected && !open) return null // the editor sheet owns the bottom of the screen
  return (
    <>
      {!open && (
        <button className={styles.fab} onClick={() => setOpen(true)} aria-haspopup="dialog">
          + Add
        </button>
      )}
      {open && (
        <>
          <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden />
          <section className={`${styles.sheet} ${styles.addSheet}`} role="dialog" aria-label="Add to the beam">
            <div className={styles.sheetBar}>
              <strong>Add to the beam</strong>
              <button className={styles.sheetClose} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            <div className={styles.sheetBody}>
              {ENTRIES.map((g) => (
                <div key={g.group}>
                  <h2 className={styles.title}>{g.group}</h2>
                  <div className={styles.tiles}>
                    {g.items.map((it) => (
                      <button
                        key={it.kind}
                        className={styles.tile}
                        onClick={() => {
                          const r = addItem(beam, it.kind)
                          commit(r.beam, r.id)
                          setOpen(false)
                        }}
                      >
                        <svg width={44} height={44} viewBox={it.box} preserveAspectRatio="xMidYMid meet" aria-hidden>
                          {it.art}
                        </svg>
                        <span>{it.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}
