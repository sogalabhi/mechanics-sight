import type { BeamInput } from '@/model/types'

const W = 168
const H = 64
const PAD = 14
const Y = 36

/** Tiny schematic of a beam: line, supports, loads. Only the shape matters, so no labels. */
export function BeamThumb({ beam }: { beam: BeamInput }) {
  const px = (x: number) => PAD + (x / beam.length) * (W - 2 * PAD)
  const ink = 'var(--ink)'
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden style={{ display: 'block', maxWidth: W }}>
      {(beam.loads ?? []).map((l) => {
        if (l.type === 'distributed') {
          const a = px(l.start)
          const b = px(l.end)
          const down = l.w_start + l.w_end < 0
          const n = Math.max(2, Math.round((b - a) / 14))
          return (
            <g key={l.id} stroke="var(--load)" strokeWidth={1.2} fill="none">
              <line x1={a} x2={b} y1={Y - 22} y2={Y - 22} />
              {Array.from({ length: n + 1 }, (_, i) => {
                const x = a + ((b - a) * i) / n
                const y1 = Y - 22
                const y2 = Y - 5
                return <path key={i} d={down ? `M${x} ${y1}V${y2}M${x - 2.5} ${y2 - 4}L${x} ${y2}L${x + 2.5} ${y2 - 4}` : `M${x} ${y2}V${y1}M${x - 2.5} ${y1 + 4}L${x} ${y1}L${x + 2.5} ${y1 + 4}`} />
              })}
            </g>
          )
        }
        if (l.type === 'moment') {
          const x = px(l.position)
          return <path key={l.id} d={`M${x - 7} ${Y - 6}A8 8 0 1 1 ${x + 7} ${Y - 6}`} stroke="var(--load)" strokeWidth={1.2} fill="none" />
        }
        const x = px(l.position)
        const up = l.magnitude > 0
        return (
          <path
            key={l.id}
            stroke="var(--load)"
            strokeWidth={1.4}
            fill="none"
            d={up ? `M${x} ${Y + 20}V${Y - 4}M${x - 3} ${Y + 1}L${x} ${Y - 4}L${x + 3} ${Y + 1}` : `M${x} ${Y - 24}V${Y - 4}M${x - 3} ${Y - 9}L${x} ${Y - 4}L${x + 3} ${Y - 9}`}
          />
        )
      })}
      <line x1={px(0)} x2={px(beam.length)} y1={Y} y2={Y} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      {beam.supports.map((s) => {
        const x = px(s.position)
        if (s.type === 'fixed') {
          const left = s.position < beam.length / 2
          const d = left ? -1 : 1
          return <path key={s.id} d={`M${x} ${Y - 11}V${Y + 11}M${x} ${Y - 7}l${5 * d} ${-4}M${x} ${Y - 1}l${5 * d} ${-4}M${x} ${Y + 5}l${5 * d} ${-4}M${x} ${Y + 11}l${5 * d} ${-4}`} stroke={ink} strokeWidth={1.3} fill="none" />
        }
        return (
          <g key={s.id} stroke={ink} strokeWidth={1.3} fill="none">
            <path d={`M${x} ${Y + 2}L${x - 6} ${Y + 13}H${x + 6}Z`} />
            {s.type === 'roller' ? <line x1={x - 8} x2={x + 8} y1={Y + 17} y2={Y + 17} /> : <line x1={x - 8} x2={x + 8} y1={Y + 13} y2={Y + 13} />}
          </g>
        )
      })}
    </svg>
  )
}
