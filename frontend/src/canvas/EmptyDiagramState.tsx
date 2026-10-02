import { emptyBeam } from '@/model/actions'
import { EXAMPLES } from '@/model/examples'
import type { BeamInput } from '@/model/types'
import { useStore } from '@/store/store'
import { BeamThumb } from './BeamThumb'
import styles from './EmptyDiagramState.module.css'

const FEATURED = ['01_ss_central_point', '02_ss_full_udl', '03_cantilever_left_udl', '05_overhang_point']

/** A starting beam with its supports in place, so the first load can be dragged straight on. */
function scratch(kind: 'ss' | 'cantilever', length: number): BeamInput {
  const b = emptyBeam(length)
  b.supports =
    kind === 'ss'
      ? [
          { id: 's1', type: 'pin', position: 0 },
          { id: 's2', type: 'roller', position: length },
        ]
      : [{ id: 's1', type: 'fixed', position: 0 }]
  return b
}

const SCRATCH: { kind: 'ss' | 'cantilever'; title: string; hint: string }[] = [
  { kind: 'ss', title: 'Simply supported', hint: 'Pin and roller at the ends' },
  { kind: 'cantilever', title: 'Cantilever', hint: 'Fixed at the left end' },
]

export function EmptyDiagramState({ width }: { width: number }) {
  const beam = useStore((s) => s.draft ?? s.beam)
  const commit = useStore((s) => s.commit)
  const error = useStore((s) => s.error)
  const hasSupports = beam.supports.length > 0
  const examples = FEATURED.map((k) => EXAMPLES.find((e) => e.key === k)).filter((e) => e !== undefined)

  return (
    <div className={styles.container} style={{ width }}>
      <div className={styles.card}>
        <ol className={styles.steps} aria-label="Progress">
          <li className={hasSupports ? styles.done : styles.current}>1 Supports</li>
          <li className={hasSupports ? styles.current : ''}>2 Loads</li>
          <li>3 Results</li>
        </ol>

        {hasSupports ? (
          <>
            <h3 className={styles.title}>This beam can&rsquo;t be solved yet</h3>
            <p className={styles.desc}>
              {error?.message ??
                'It is free to move or rotate. Add a support that stops it, for example a pin and a roller, or a fixed end.'}
            </p>
          </>
        ) : (
          <>
            <h3 className={styles.title}>Start a beam</h3>
            <p className={styles.desc}>
              Shear, moment and deflection appear as soon as the beam is supported. Begin from an example, or build your own.
            </p>
          </>
        )}

        {!hasSupports && (
          <section aria-labelledby="ex-h">
            <h4 id="ex-h" className={styles.heading}>Try an example</h4>
            <div className={styles.tiles}>
              {examples.map((ex) => (
                <button key={ex.key} className={styles.tile} onClick={() => commit(structuredClone(ex.beam), null)}>
                  <BeamThumb beam={ex.beam} />
                  <span className={styles.tileTitle}>{ex.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="sc-h">
          <h4 id="sc-h" className={styles.heading}>{hasSupports ? 'Or reset the supports' : 'Start from scratch'}</h4>
          <div className={styles.tiles}>
            {SCRATCH.map((s) => (
              <button
                key={s.kind}
                className={styles.tile}
                onClick={() => {
                  const next = scratch(s.kind, beam.length)
                  next.loads = beam.loads
                  commit(next, null)
                }}
              >
                <BeamThumb beam={scratch(s.kind, 6)} />
                <span className={styles.tileTitle}>{s.title}</span>
                <span className={styles.tileHint}>{s.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <p className={styles.tip}>
          You can also drag a support or load from the palette onto the beam. Everything is solved exactly, with working shown.
        </p>
      </div>
    </div>
  )
}
