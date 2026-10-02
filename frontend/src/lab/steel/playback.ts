import { sliderToStrain, strainToSlider } from './history'
import { fractureStrainOf, useLab } from './store'
import type { DisplayState, TracePoint } from './types'

/** Slider units per second: the whole run from zero to fracture takes about ten seconds. */
const SPEED = 100

let raf = 0
let last = 0
let u = 0

/** The reference trace without its final post-fracture drop: loading only, increasing in strain. */
function loadingTrace(trace: TracePoint[]): TracePoint[] {
  return trace[trace.length - 1]?.region === 'fractured' ? trace.slice(0, -1) : trace
}

/** A replayed point: values interpolated between the two exact trace points around `strain`. */
export function interpolate(trace: TracePoint[], strain: number, areaMm2: number, gaugeMm: number): DisplayState {
  let i = 1
  while (i < trace.length - 1 && trace[i].strain < strain) i++
  const a = trace[i - 1]
  const b = trace[i]
  const t = b.strain === a.strain ? 0 : Math.min(1, Math.max(0, (strain - a.strain) / (b.strain - a.strain)))
  const stress = a.stress_mpa + (b.stress_mpa - a.stress_mpa) * t
  const plastic = a.plastic_strain + (b.plastic_strain - a.plastic_strain) * t
  return {
    strain,
    stress_mpa: stress,
    force_kn: (stress * areaMm2) / 1000,
    extension_mm: strain * gaugeMm,
    plastic_strain: plastic,
    elastic_strain: strain - plastic,
    max_strain: strain,
    region: t < 1 ? a.region : b.region,
    landmark: null,
  }
}

function frame(now: number) {
  const s = useLab.getState()
  const ref = s.reference
  if (!s.playing || !ref) return
  u = Math.min(1000, u + ((now - last) / 1000) * SPEED)
  last = now
  const strain = sliderToStrain(u, fractureStrainOf(s))
  s.setOverlay(interpolate(loadingTrace(ref.trace), strain, ref.specimen.area_mm2, ref.specimen.gauge_length_mm))
  if (u >= 1000) {
    pause()
    return
  }
  raf = requestAnimationFrame(frame)
}

/** Replay the loading path from where the specimen is now. Pausing sets the exact state there. */
export function play() {
  const s = useLab.getState()
  const state = s.response?.state
  if (!s.reference || !state || state.region === 'fractured') return
  u = strainToSlider(state.max_strain, fractureStrainOf(s))
  last = performance.now()
  s.setPlaying(true)
  raf = requestAnimationFrame(frame)
}

/** Stop replaying and ask the server for the exact state at the strain reached. */
export function pause() {
  cancelAnimationFrame(raf)
  const s = useLab.getState()
  if (!s.playing) return
  const strain = s.overlay?.strain
  s.setPlaying(false)
  if (strain !== undefined) s.moveTo(u >= 1000 ? fractureStrainOf(s) : strain)
}
