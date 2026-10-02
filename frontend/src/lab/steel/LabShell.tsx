import { useEffect } from 'react'
import { useMediaQuery } from '@/canvas/useMediaQuery'
import { formatNumber } from '@/math/format'
import { applyTheme, loadTheme } from '@/model/theme'
import { Controls } from './Controls'
import { Curve } from './Curve'
import { REGION_TEXT, LANDMARK_TEXT } from './content'
import { startLabLive } from './live'
import { pause } from './playback'
import { Readouts } from './Readouts'
import { SidePane } from './SidePane'
import { Specimen, STRETCH_SCALE } from './Specimen'
import { LAB_ROUTE, encodeHistory, historyFromHash } from './share'
import { LabTopBar } from './LabTopBar'
import styles from './lab.module.css'
import { displayState, useLab } from './store'

/** The Steel Material Lab workspace: a strain-controlled tension test. Every number comes from the backend. */
export default function LabShell() {
  const phone = useMediaQuery('(max-width: 760px)')
  const s = useLab()
  const state = displayState(s)
  const out = s.response

  useEffect(() => applyTheme(loadTheme()), [])
  useEffect(() => {
    const stop = startLabLive()
    return () => {
      pause()
      stop()
    }
  }, [])
  // a link opened while the lab is already showing (or on load) restores its history
  useEffect(() => {
    const apply = () => {
      const h = historyFromHash(window.location.hash)
      if (h && JSON.stringify(h) !== JSON.stringify(useLab.getState().history)) useLab.getState().setHistory(h)
    }
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])
  // keep the address bar in step with the loading history so a reload or a copied link restores it
  const history = useLab((x) => x.history)
  useEffect(() => {
    const hash = history.length ? `${LAB_ROUTE}?h=${encodeHistory(history)}` : LAB_ROUTE
    if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
  }, [history])

  const showSpecimen = !phone || s.view === 'specimen'
  const showCurve = !phone || s.view === 'curve'
  const region = state ? REGION_TEXT[state.region] : null
  const point = state?.landmark ? LANDMARK_TEXT[state.landmark] : null

  return (
    <div className={styles.shell} data-busy={s.analyzing || s.response === null}>
      <header className={styles.top}><LabTopBar /></header>
      <main className={styles.main}>
        {s.error && (
          <div className={`${styles.banner} ${s.error.kind === 'network' ? styles.warn : styles.danger}`} role="alert">
            {s.error.message}
            {s.error.kind === 'solver' && (
              <button className={styles.btn} style={{ marginLeft: 12 }} onClick={() => s.reset()}>Reset specimen</button>
            )}
          </div>
        )}
        <div className={`${styles.seg} ${styles.viewseg}`} role="group" aria-label="View">
          <button aria-pressed={s.view === 'specimen'} onClick={() => s.setView('specimen')}>Specimen</button>
          <button aria-pressed={s.view === 'curve'} onClick={() => s.setView('curve')}>Curve</button>
        </div>
        <div className={styles.views}>
          {showSpecimen && (
            <section className={styles.view} aria-label="Specimen">
              <div className={styles.vhead}>
                <span>Specimen{out ? ` · Ø${formatNumber(out.specimen.diameter_mm, { decimals: 0 })} mm, L₀ = ${formatNumber(out.specimen.gauge_length_mm, { decimals: 0 })} mm` : ''}</span>
                <span className={styles.badge}>elastic stretch drawn ×{STRETCH_SCALE} (readouts are real)</span>
              </div>
              {out && state ? <div className={s.analyzing ? styles.dim : undefined}><Specimen state={state} out={out} /></div> : <div className={styles.solving} role="status">Solving…</div>}
            </section>
          )}
          {showCurve && (
            <section className={styles.view} aria-label="Engineering stress–strain curve">
              <div className={styles.vhead}>
                <span>Engineering stress–strain</span>
                <span className={styles.badge}>engineering σ = F / A₀ &nbsp; ε = ΔL / L₀</span>
              </div>
              {out && state ? <div className={s.analyzing ? styles.dim : undefined}><Curve state={state} out={out} reference={s.reference} zoom={s.zoom} proof={s.proof} /></div> : <div className={styles.solving} role="status">Solving…</div>}
            </section>
          )}
        </div>
        <Controls />
        {state && <div className={`${styles.controls} ${styles.nogap}`}><Readouts state={state} /></div>}
        {state && region && (
          <div className={styles.explain} aria-live="polite">
            <p data-testid="explanation" data-region={state.region} data-landmark={state.landmark ?? ''}>
              <span className={`${styles.region} ${styles[region.tone]}`}>{point ? `Point ${state.landmark} · ${point.title}` : region.title}</span>
              {point ? point.text : region.text}
            </p>
            <div className={styles.row}>
              <button className={styles.btn} onClick={() => s.setTab('explain')}>Why?</button>
              <button className={styles.btn} onClick={() => s.setTab('maths')}>Show maths</button>
            </div>
          </div>
        )}
      </main>
      <aside className={styles.pane}><SidePane /></aside>
      <footer className={`${styles.status} num`}>
        {state ? (
          <>
            <span>σ = <b>{state.stress_mpa > 1e-9 ? '+' : ''}{formatNumber(state.stress_mpa, { decimals: 1 })}</b> MPa</span>
            <span>ε = <b>{formatNumber(state.strain * 100)}</b> %</span>
            <span>F = <b>{formatNumber(state.force_kn)}</b> kN</span>
          </>
        ) : (
          <span>—</span>
        )}
        <span style={{ marginLeft: 'auto' }}>Engineering stress and strain · tension only</span>
      </footer>
    </div>
  )
}
