import { ArrowHead } from './Arrow'
import { formatNumber, formatQty } from '@/math/format'
import { MONO, stroke } from './state'

export interface KeyPoint {
  /** px */
  x: number
  /** metres */
  value: number
}

interface Props {
  /** Sorted key points, including 0 and L. */
  points: KeyPoint[]
  showHandle?: boolean
}

const CHAIN_Y = 70
const OVERALL_Y = 92
const EXT_FROM = 49

export function DimensionChain({ points, showHandle = false }: Props) {
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const ink2 = stroke('default', 'var(--ink-2)', 1)
  const ink = stroke('default', 'var(--ink)', 1)
  return (
    <g>
      {/* extension lines */}
      {points.map((p, i) => (
        <line key={`e${i}`} {...ink2} x1={p.x} y1={EXT_FROM} x2={p.x} y2={CHAIN_Y + 4} />
      ))}
      <line {...ink2} x1={first.x} y1={CHAIN_Y + 4} x2={first.x} y2={OVERALL_Y + 4} />
      <line {...ink2} x1={last.x} y1={CHAIN_Y + 4} x2={last.x} y2={OVERALL_Y + 4} />

      {/* chain */}
      <line {...ink} x1={first.x} y1={CHAIN_Y} x2={last.x} y2={CHAIN_Y} />
      {points.map((p, i) => (
        <line key={`t${i}`} {...ink} x1={p.x - 3} y1={CHAIN_Y + 3} x2={p.x + 3} y2={CHAIN_Y - 3} />
      ))}
      {points.slice(1).map((p, i) => {
        const prev = points[i]
        const wpx = p.x - prev.x
        const text = formatNumber(p.value - prev.value)
        return wpx >= 28 ? (
          <text key={`l${i}`} x={(p.x + prev.x) / 2} y={CHAIN_Y - 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="var(--ink)">
            {text}
          </text>
        ) : (
          <g key={`l${i}`}>
            <rect x={prev.x} y={CHAIN_Y - 8} width={wpx} height={10} fill="transparent" />
            <title>{text}</title>
          </g>
        )
      })}

      {/* overall */}
      <line {...ink} x1={first.x + 9} y1={OVERALL_Y} x2={last.x - 9} y2={OVERALL_Y} />
      <ArrowHead x={first.x} y={OVERALL_Y} dx={-1} dy={0} length={9} width={5} color="var(--ink)" />
      <ArrowHead x={last.x} y={OVERALL_Y} dx={1} dy={0} length={9} width={5} color="var(--ink)" />
      <text x={(first.x + last.x) / 2} y={OVERALL_Y - 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="var(--ink)">
        {`L = ${formatQty(last.value - first.value, 'm')}`}
      </text>
      {showHandle && (
        <rect x={last.x - 5} y={OVERALL_Y - 5} width={10} height={10} {...stroke('selected', 'var(--select)', 1.5)} fill="var(--paper)" />
      )}
    </g>
  )
}
