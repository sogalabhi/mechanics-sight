import { useXScale } from '@/canvas/xscale'
import { tangentAt } from '@/math/poly'
import { useStore } from '@/store/store'

interface Props {
  yOf: (m: number) => number
  height: number
}

/**
 * Dynamic Calculus Tangent Visualizer on the Bending Moment Diagram (BMD).
 * Renders the live tangent line representing dM/dx = V(x).
 * When V(x) ≈ 0, renders a horizontal tangent with emerald glow indicating peak moment.
 */
export function CalculusTangent({ yOf, height: _height }: Props) {
  const showCalculus = useStore((s) => s.showCalculus)
  const pinned = useStore((s) => s.pinnedX)
  const hover = useStore((s) => s.hoverX)
  const result = useStore((s) => s.result)
  const xs = useXScale()

  const mx = pinned ?? hover
  if (!showCalculus || !result || mx === null) return null

  const t = tangentAt(result, mx, xs, yOf, 42)
  if (!t) return null

  const { px, py, isZeroShear, isKink, isZeroCrossing, leftRay, rightRay, fullSegment } = t

  return (
    <g pointerEvents="none" aria-hidden="true">
      {isZeroShear && !isZeroCrossing ? (
        // Smooth peak moment / horizontal tangent (V = 0)
        <g>
          {/* Emerald glowing halo */}
          <line
            x1={fullSegment.x1}
            y1={fullSegment.y1}
            x2={fullSegment.x2}
            y2={fullSegment.y2}
            stroke="var(--ok)"
            strokeWidth={7}
            strokeOpacity={0.25}
            strokeLinecap="round"
          />
          {/* Solid horizontal tangent line */}
          <line
            x1={fullSegment.x1}
            y1={fullSegment.y1}
            x2={fullSegment.x2}
            y2={fullSegment.y2}
            stroke="var(--ok)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* End tick markers */}
          <circle cx={fullSegment.x1} cy={fullSegment.y1} r={2.5} fill="var(--ok)" />
          <circle cx={fullSegment.x2} cy={fullSegment.y2} r={2.5} fill="var(--ok)" />
          {/* Center contact point */}
          <circle cx={px} cy={py} r={5} fill="var(--ok)" stroke="var(--panel)" strokeWidth={2} />
        </g>
      ) : isKink ? (
        // Cusp kink (e.g. concentrated point load)
        <g>
          {/* Left half-tangent */}
          <line
            x1={leftRay.x1}
            y1={leftRay.y1}
            x2={leftRay.x2}
            y2={leftRay.y2}
            stroke={isZeroCrossing ? 'var(--ok)' : 'var(--shear)'}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          {/* Right half-tangent */}
          <line
            x1={rightRay.x1}
            y1={rightRay.y1}
            x2={rightRay.x2}
            y2={rightRay.y2}
            stroke={isZeroCrossing ? 'var(--ok)' : 'var(--shear)'}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          {/* End dots */}
          <circle cx={leftRay.x1} cy={leftRay.y1} r={2.5} fill={isZeroCrossing ? 'var(--ok)' : 'var(--shear)'} />
          <circle cx={rightRay.x2} cy={rightRay.y2} r={2.5} fill={isZeroCrossing ? 'var(--ok)' : 'var(--shear)'} />
          {/* Cusp contact point */}
          <circle
            cx={px}
            cy={py}
            r={5}
            fill={isZeroCrossing ? 'var(--ok)' : 'var(--shear)'}
            stroke="var(--panel)"
            strokeWidth={2}
          />
        </g>
      ) : (
        // Smooth non-zero slope (dM/dx = V(x))
        <g>
          {/* Subtle dashed extension to emphasize the geometric tangent line */}
          <line
            x1={fullSegment.x1 - (fullSegment.x2 - px) * 0.35}
            y1={fullSegment.y1 - (fullSegment.y2 - py) * 0.35}
            x2={fullSegment.x2 + (fullSegment.x2 - px) * 0.35}
            y2={fullSegment.y2 + (fullSegment.y2 - py) * 0.35}
            stroke="var(--shear)"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            opacity={0.4}
          />
          {/* Main solid tangent segment */}
          <line
            x1={fullSegment.x1}
            y1={fullSegment.y1}
            x2={fullSegment.x2}
            y2={fullSegment.y2}
            stroke="var(--shear)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          {/* End dots */}
          <circle cx={fullSegment.x1} cy={fullSegment.y1} r={2} fill="var(--shear)" opacity={0.8} />
          <circle cx={fullSegment.x2} cy={fullSegment.y2} r={2} fill="var(--shear)" opacity={0.8} />
          {/* Center contact point */}
          <circle cx={px} cy={py} r={4.5} fill="var(--shear)" stroke="var(--panel)" strokeWidth={1.5} />
        </g>
      )}
    </g>
  )
}
