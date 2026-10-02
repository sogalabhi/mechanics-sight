import { formatNumber } from '@/math/format'
import { LANDMARK_TEXT, REGION_TEXT } from './content'
import { Math as Tex } from '@/working/Math'
import { mathsFor } from './maths'
import { RichText } from './RichText'
import styles from './lab.module.css'
import { displayState, useLab, type LabTab } from './store'
import type { TensionOut } from './types'

const TABS: { id: LabTab; label: string }[] = [
  { id: 'preset', label: 'Preset' },
  { id: 'explain', label: 'Explain' },
  { id: 'maths', label: 'Maths' },
]

const n0 = (v: number) => formatNumber(v, { decimals: 0 })

function PresetTab({ out }: { out: TensionOut }) {
  const p = out.model.parameters
  const rows: [string, string][] = [
    ['Young’s modulus E', `${n0(out.model.young_modulus_gpa)} GPa`],
    ['A proportional limit', `${n0(p.proportional_limit_mpa)} MPa`],
    ['B elastic limit', `${n0(p.elastic_limit_mpa)} MPa`],
    ['C upper yield', `${n0(p.upper_yield_mpa)} MPa`],
    ['D lower yield f_y', `${n0(p.lower_yield_mpa)} MPa`],
    ['Plateau ends ε_sh', `${formatNumber(p.strain_hardening * 100, { decimals: 1 })} %`],
    ['E peak (UTS) f_u', `${n0(p.peak_mpa)} MPa @ ${n0(p.strain_peak * 100)} %`],
    ['F fracture', `${n0(p.fracture_mpa)} MPa @ ${n0(p.strain_fracture * 100)} %`],
  ]
  return (
    <>
      <h2>Preset</h2>
      <p style={{ margin: '0 0 8px' }}>
        <b>{out.model.name}</b> <span className={`${styles.badge} ${styles.badgeWarn}`}>educational {out.model.kind}</span>
      </p>
      <dl className={`${styles.kv} num`}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h3>Specimen</h3>
      <dl className={`${styles.kv} num`}>
        <dt>Diameter d₀</dt><dd>{n0(out.specimen.diameter_mm)} mm</dd>
        <dt>Gauge length L₀</dt><dd>{n0(out.specimen.gauge_length_mm)} mm</dd>
        <dt>Original area A₀</dt><dd>{formatNumber(out.specimen.area_mm2)} mm²</dd>
      </dl>
      <p className={styles.hint}>
        Not a measured steel. The six points A to F are a textbook idealisation with illustrative values. A, B and C sit within about 35 MPa of each other; real steel varies by grade and test, and A and B are hard to tell apart.
      </p>
    </>
  )
}

function ExplainTab({ out }: { out: TensionOut }) {
  const state = displayState(useLab.getState()) ?? out.state
  const lm = state.landmark ? LANDMARK_TEXT[state.landmark] : null
  const r = REGION_TEXT[state.region]
  const proof = out.proof
  const offset = formatNumber(proof.offset_strain * 100, { decimals: 1 })
  return (
    <>
      <h2>Explain</h2>
      {lm && (
        <p>
          <b>Point {state.landmark} · {lm.title}.</b> {lm.text}
        </p>
      )}
      <p>
        <b>{r.title}.</b> {r.text}
      </p>
      <h3>Try it</h3>
      <p>Go to point E, then press Unload. Predict first: how much strain comes back? Check the plastic strain readout.</p>

      <h3>Proof strength ({offset} % offset)</h3>
      <p>
        <RichText text={String.raw`Some metals, such as aluminium or cold-worked steel, have no clear yield point: the curve bends away from the straight line smoothly, so there is no single place to call yield. Engineers instead agree on the stress that leaves a small, fixed permanent strain, usually $0.2\,\%$. That stress is the **proof strength** $\sigma_{0.2}$.`} />
      </p>
      <p>
        <RichText text={String.raw`To find it, draw a line with the same slope $E$ as the elastic line, moved right by the offset $0.002$ of strain. Where it meets the curve is the proof point:`} />
      </p>
      <p><Tex block tex={String.raw`\sigma_{\text{curve}}(\varepsilon) = E\,(\varepsilon - 0.002)`} /></p>
      <p>
        <RichText text={String.raw`The $0.2\,\%$ is a *permanent* (residual) strain, not the total strain at that point. Unload from the proof point along a line of slope $E$ and exactly $0.002$ of strain stays:`} />
      </p>
      <p><Tex block tex={String.raw`\varepsilon_p = \varepsilon - \frac{\sigma}{E}`} /></p>
      <p>
        <RichText
          text={String.raw`For this steel the proof point is at a total strain of $${formatNumber(proof.strain, { decimals: 5 })}$ with $\sigma_{0.2} = ${formatNumber(proof.stress_mpa, { decimals: 1 })}$ MPa. The steel has a distinct yield plateau, so the point lands on the plateau and $\sigma_{0.2}$ equals the lower yield $f_y$. A metal with no plateau is read off the offset line in just this way.`}
        />
      </p>
      <p className={styles.hint}>
        Try it: switch on <b>0.2 % proof line</b>, press <b>P</b> to go to the proof point, then Unload. The plastic strain readout shows {formatNumber(proof.offset_strain * 100)} %.
      </p>

      <h3>Careful</h3>
      <p>
        This graph is <i>engineering</i> stress: force divided by the original area. After the peak it falls, but the stress in the neck itself keeps rising. The test only pulls, so stress never goes below zero. Proof strength is an agreed convention, not a physical boundary, and this curve is a textbook idealisation, not a measured steel.
      </p>
    </>
  )
}

function MathsTab({ out }: { out: TensionOut }) {
  const state = displayState(useLab.getState()) ?? out.state
  return (
    <>
      <h2>Maths</h2>
      {mathsFor(state, out).map((b) => (
        <div key={b.title}>
          <h3>{b.title}</h3>
          {b.lines.map((l) => (
            <div key={l} className={styles.eq} data-tex>
              <Tex tex={l} block />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

/** Preset, Explain and Maths. The explanation and the working follow the point on the curve. */
export function SidePane() {
  const tab = useLab((s) => s.tab)
  const setTab = useLab((s) => s.setTab)
  const out = useLab((s) => s.response)
  useLab((s) => s.overlay) // re-render with the replayed point while playing
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Side pane">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={styles.tab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.pbody} role="tabpanel">
        {!out ? <p className={styles.hint}>Solving…</p> : tab === 'preset' ? <PresetTab out={out} /> : tab === 'explain' ? <ExplainTab out={out} /> : <MathsTab out={out} />}
      </div>
    </>
  )
}
