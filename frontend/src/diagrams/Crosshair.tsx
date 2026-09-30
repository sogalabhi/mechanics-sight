import { formatNumber } from '@/math/format'
import { isJump, valueAt, type Kind } from '@/math/poly'
import { useXScale } from '@/canvas/xscale'
import { useStore } from '@/store/store'

interface Props {
  /** Omit for the beam panel: a line only. */
  kind?: Kind
  yOf?: (v: number) => number
  height: number
  color?: string
  unit?: string
}

export function Crosshair({ kind, yOf, height, color = 'var(--ink)', unit = '' }: Props) {
  const pinned = useStore((s) => s.pinnedX)
  const hover = useStore((s) => s.hoverX)
  const result = useStore((s) => s.result)
  const xs = useXScale()
  const mx = pinned ?? hover
  if (mx === null) return null
  const px = xs(mx)
  const v = kind && result && yOf ? valueAt(result, mx, kind) : null
  const jump = v ? isJump(v) : false
  const sign = kind === 'shear'
  const name = kind === 'shear' ? 'V' : 'M'
  const text = v
    ? jump
      ? `${name} = ${formatNumber(v.left, { sign })} / ${formatNumber(v.right, { sign })} ${unit}`
      : `${name} = ${formatNumber(v.right, { sign })} ${unit}`
    : ''
  const flip = px > xs.range()[1] - 150
  const py = v && yOf ? yOf(v.right) : 0
  return (
    <g pointerEvents="none">
      <line x1={px} x2={px} y1={0} y2={height} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray={pinned === null ? '3 3' : undefined} />
      {v && yOf && (
        <>
          <circle cx={px} cy={yOf(v.right)} r={4} fill={color} />
          {jump && <circle cx={px} cy={yOf(v.left)} r={4} fill={color} />}
          <rect x={flip ? px - 8 - text.length * 6.6 - 8 : px + 8} y={py - 22} width={text.length * 6.6 + 8} height={18} rx={3} fill="var(--panel)" stroke="var(--rule)" />
          <text x={flip ? px - 12 : px + 12} y={py - 9} textAnchor={flip ? 'end' : 'start'} fontFamily="var(--font-mono)" fontSize={11} fill="var(--ink)">
            {text}
          </text>
        </>
      )}
    </g>
  )
}
