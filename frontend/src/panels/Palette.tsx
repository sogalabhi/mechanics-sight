import type { ReactNode } from 'react'
import { Couple, DistributedLoad, FixedSupport, PinSupport, PointLoad, RollerSupport } from '@/drawing'
import { addItem, type PaletteKind } from '@/model/actions'
import { useStore } from '@/store/store'
import styles from './panels.module.css'

const p = <T,>(v: T) => v

const ENTRIES: { group: string; items: { kind: PaletteKind; name: string; box: string; art: ReactNode }[] }[] = [
  {
    group: 'Supports',
    items: [
      { kind: 'pin', name: 'Pin', box: '-18 0 36 34', art: <PinSupport x={0} /> },
      { kind: 'roller', name: 'Roller', box: '-18 0 36 34', art: <RollerSupport x={0} /> },
      { kind: 'fixed', name: 'Fixed', box: '-10 -26 36 52', art: <FixedSupport x={0} end="left" /> },
    ],
  },
  {
    group: 'Loads',
    items: [
      { kind: 'point', name: 'Point load', box: '-12 -60 24 60', art: <PointLoad x={0} magnitude={p(-1)} /> },
      { kind: 'moment', name: 'Moment', box: '-20 -24 40 32', art: <Couple x={0} magnitude={1} /> },
      { kind: 'udl', name: 'UDL', box: '-20 -50 40 50', art: <DistributedLoad xs={-16} xe={16} w1={-1} w2={-1} wMax={1} /> },
      { kind: 'uvl', name: 'UVL', box: '-20 -50 40 50', art: <DistributedLoad xs={-16} xe={16} w1={0} w2={-1} wMax={1} /> },
      { kind: 'trapezoidal', name: 'Trapezoidal', box: '-20 -50 40 50', art: <DistributedLoad xs={-16} xe={16} w1={-0.4} w2={-1} wMax={1} /> },
    ],
  },
]

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
