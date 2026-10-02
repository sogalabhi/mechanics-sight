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
  const sawCutX = useStore((s) => s.sawCutX)
  const toggleSawAt = useStore((s) => s.toggleSawAt)
  const beam = useStore((s) => s.beam)
  const result = useStore((s) => s.result)
  const showCalculus = useStore((s) => s.showCalculus)
  const xs = useXScale()

  const mx = pinned ?? hover
  if (mx === null) return null
  const px = xs(mx)

  const v = kind && result && yOf ? valueAt(result, mx, kind) : null
  const jump = v ? isJump(v) : false
  const sign = kind === 'shear'
  const name = kind === 'shear' ? 'V' : 'M'

  // Calculus intuition derivation: V(x) = dM/dx
  let subText: string | null = null
  let isZeroShear = false

  if (showCalculus && result && kind) {
    const vShear = valueAt(result, mx, 'shear')
    const zTol = 1e-4
    const isZeroShearPoint = result.zero_shear_points.some((z) => Math.abs(z - mx) < zTol)
    const isSmoothZero = Math.abs(vShear.right) < zTol || Math.abs(vShear.left) < zTol
    const isZeroCrossing = vShear.left * vShear.right < -1e-9
    isZeroShear = isZeroShearPoint || isSmoothZero || isZeroCrossing

    if (kind === 'shear') {
      if (isZeroShear) {
        subText = 'dM/dx = 0 → Peak Moment'
      } else {
        subText = '= Slope dM/dx of BMD'
      }
    } else if (kind === 'moment') {
      if (isZeroShear && !isZeroCrossing) {
        subText = 'Slope dM/dx = 0 (Peak M)'
      } else if (isJump(vShear)) {
        subText = `dM/dx = ${formatNumber(vShear.left, { sign: true })} / ${formatNumber(vShear.right, { sign: true })} kN`
      } else {
        subText = `Slope dM/dx = ${formatNumber(vShear.right, { sign: true })} kN`
      }
    }
  }

  const text = v
    ? jump
      ? `${name} = ${formatNumber(v.left, { sign })} / ${formatNumber(v.right, { sign })} ${unit}`
      : `${name} = ${formatNumber(v.right, { sign })} ${unit}`
    : ''

  const badgeHeight = subText ? 34 : 18
  const maxChars = Math.max(text.length, subText ? subText.length : 0)
  const badgeWidth = maxChars * 6.8 + 16
  const flip = px > xs.range()[1] - badgeWidth - 12
  const badgeX = flip ? px - 8 - badgeWidth : px + 8
  const textX = flip ? badgeX + badgeWidth - 8 : badgeX + 8
  const textAnchor = flip ? 'end' : 'start'

  const py = v && yOf ? yOf(v.right) : 0
  const badgeY = py < 44 ? py + 8 : py - badgeHeight - 4

  const activeColor = isZeroShear ? '#10b981' : color

  return (
    <g pointerEvents="none">
      <line
        x1={px}
        x2={px}
        y1={0}
        y2={height}
        stroke="var(--ink-2)"
        strokeWidth={1}
        strokeDasharray={pinned === null ? '3 3' : undefined}
      />
      {!kind && mx > 1e-4 && mx < beam.length - 1e-4 && (
        <g
          pointerEvents="auto"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            toggleSawAt(mx)
          }}
        >
          <rect
            x={px - 40}
            y={8}
            width={80}
            height={20}
            rx={4}
            fill="var(--panel)"
            stroke={sawCutX === mx ? '#d97706' : 'var(--rule)'}
            strokeWidth={1.2}
          />
          <text
            x={px}
            y={22}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={10}
            fontWeight={600}
            fill={sawCutX === mx ? '#d97706' : 'var(--ink)'}
          >
            {sawCutX === mx ? '🪚 Close' : '🪚 Saw Cut'}
          </text>
        </g>
      )}
      {v && yOf && (
        <>
          <circle
            cx={px}
            cy={yOf(v.right)}
            r={isZeroShear ? 5 : 4}
            fill={activeColor}
            stroke={isZeroShear ? 'var(--panel)' : undefined}
            strokeWidth={isZeroShear ? 1.5 : 0}
          />
          {jump && (
            <circle
              cx={px}
              cy={yOf(v.left)}
              r={isZeroShear ? 5 : 4}
              fill={activeColor}
              stroke={isZeroShear ? 'var(--panel)' : undefined}
              strokeWidth={isZeroShear ? 1.5 : 0}
            />
          )}
          <rect
            x={badgeX}
            y={badgeY}
            width={badgeWidth}
            height={badgeHeight}
            rx={4}
            fill="var(--panel)"
            stroke={isZeroShear ? '#10b981' : 'var(--rule)'}
            strokeWidth={isZeroShear ? 1.5 : 1}
          />
          <text
            x={textX}
            y={badgeY + (subText ? 14 : 13)}
            textAnchor={textAnchor}
            fontFamily="var(--font-mono)"
            fontSize={11}
            fontWeight={isZeroShear ? 600 : 400}
            fill="var(--ink)"
          >
            {text}
          </text>
          {subText && (
            <text
              x={textX}
              y={badgeY + 27}
              textAnchor={textAnchor}
              fontFamily="var(--font-mono)"
              fontSize={10}
              fontWeight={isZeroShear ? 600 : 400}
              fill={isZeroShear ? '#10b981' : 'var(--ink-2)'}
            >
              {subText}
            </text>
          )}
        </>
      )}
    </g>
  )
}
