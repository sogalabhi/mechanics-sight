import { formatNumber } from '@/math/format'
import { NumberField } from '@/ui/NumberField'
import { LANDMARK_TEXT } from './content'
import { pause, play } from './playback'
import styles from './lab.module.css'
import { displayState, fractureStrainOf, isFractured, sliderPosition, useLab } from './store'

/** Strain slider and numeric entry, A to F jump buttons, Play / Unload / Reset, and the curve range. */
export function Controls() {
  const s = useLab()
  const fractured = isFractured(s)
  const state = displayState(s)
  const u = sliderPosition(s)
  const ready = s.response !== null
  /** Go to a strain. A bar already stretched past it cannot go back (that would need compression), so a point behind the maximum reached is shown on a fresh specimen. */
  const goTo = (strain: number, label: string) => {
    if (s.playing) pause()
    if (state && strain < state.max_strain - 1e-12) {
      s.setHistory([{ op: 'strain', to: strain }])
      s.setNote(`Started a fresh specimen to show ${label}: a bar already stretched past it cannot go back.`)
    } else {
      s.moveTo(strain)
    }
  }

  return (
    <div className={styles.controls}>
      <div className={styles.row}>
        <div className={styles.slider}>
          <label htmlFor="lab-strain-slider">Strain you apply (the material decides the stress). The slider is finer at small strain.</label>
          <input
            id="lab-strain-slider"
            type="range"
            min={0}
            max={1000}
            step={1}
            value={s.gesture ? (s.gesture.points[s.gesture.points.length - 1] ?? s.gesture.start) : u}
            disabled={!ready || fractured}
            aria-valuetext={state ? `${formatNumber(state.strain * 100)} % strain` : undefined}
            onChange={(e) => {
              const st = useLab.getState()
              if (st.playing) pause()
              if (!st.gesture) st.beginGesture(sliderPosition(st))
              st.dragTo(Number(e.target.value))
            }}
            onPointerUp={() => s.endGesture()}
            onPointerCancel={() => s.endGesture()}
            onKeyUp={() => s.endGesture()}
            onBlur={() => s.endGesture()}
          />
        </div>
        <div className={styles.strain}>
          <NumberField
            label="Strain"
            unit="%"
            step={0.1}
            value={state ? state.strain * 100 : 0}
            onCommit={(v) => {
              const st = useLab.getState()
              if (isFractured(st)) return 'The specimen has broken. Reset to start again.'
              const max = fractureStrainOf(st) * 100
              if (v < 0 || v > max + 1e-9) return `Must be between 0 and ${formatNumber(max)} %`
              const permanent = st.response?.state.plastic_strain ?? 0
              if (v / 100 < permanent - 1e-12 && st.response && st.response.state.max_strain > v / 100) {
                return `Below the permanent strain (${formatNumber(permanent * 100)} %). Reset to start again.`
              }
              st.moveTo(v / 100)
              return null
            }}
          />
        </div>
      </div>

      <div className={`${styles.row} ${styles.chips}`}>
        <span className={styles.note}>Go to</span>
        {(s.response?.landmarks ?? []).map((m) => (
          <button
            key={m.id}
            className={`${styles.btn} ${styles.chip}`}
            aria-pressed={state?.landmark === m.id}
            aria-label={`Go to point ${m.id}, ${LANDMARK_TEXT[m.id]?.title ?? m.name}`}
            title={`${m.id}: ${LANDMARK_TEXT[m.id]?.title ?? m.name}`}
            disabled={fractured}
            onClick={() => goTo(m.strain, `point ${m.id}`)}
          >
            {m.id}
          </button>
        ))}
        {s.response && (
          <button
            className={`${styles.btn} ${styles.chip}`}
            aria-label="Go to the 0.2 % proof point"
            title="The 0.2 % offset proof point: unloading from here leaves 0.2 % permanent strain"
            disabled={fractured}
            onClick={() => goTo(s.response!.proof.strain, 'the 0.2 % proof point')}
          >
            P
          </button>
        )}
        <span className={styles.spacer} />
        <button className={styles.btn} aria-pressed={s.proof} onClick={() => s.setProof(!s.proof)} title="Draw the line parallel to the elastic line, offset by 0.2 % strain">
          0.2 % proof line
        </button>
        <div className={styles.seg} role="group" aria-label="Curve range">
          <button aria-pressed={!s.zoom} onClick={() => s.setZoom(false)}>Full curve</button>
          <button aria-pressed={s.zoom} onClick={() => s.setZoom(true)}>Zoom: elastic</button>
        </div>
      </div>

      <div className={styles.row}>
        <button
          className={`${styles.btn} ${styles.primary}`}
          disabled={!ready || fractured || !s.reference}
          onClick={() => (s.playing ? pause() : play())}
        >
          {s.playing ? 'Pause' : 'Play to fracture'}
        </button>
        <button
          className={styles.btn}
          disabled={!state || fractured || state.stress_mpa < 1e-9}
          title="Remove the load: stress returns to zero, permanent strain stays"
          onClick={() => {
            if (s.playing) pause()
            s.unload()
          }}
        >
          Unload
        </button>
        <button className={styles.btn} title="A fresh specimen. Not the same as unloading." onClick={() => s.reset()}>
          Reset specimen
        </button>
        <span className={styles.spacer} />
        <span className={styles.note} role="status">{s.note ?? 'Playback speed is presentation only, not a strain rate.'}</span>
      </div>
    </div>
  )
}

