import { useState, type ReactNode } from 'react'
import {
  Beam, Couple, DimensionChain, DistributedLoad, FixedSupport, PinSupport, PointLoad, RollerSupport,
  loadHeight, ReactionForce, ReactionMoment,
} from '@/drawing'
import { formatQty } from '@/math/format'
import { packLanes } from '@/math/lanes'
import { allItems, keyPoints } from '@/model/actions'
import type { Item } from '@/model/types'
import { useStore } from '@/store/store'
import { useXScale } from './XScaleContext'

export const BEAM_Y = 130
export const BEAM_PANEL_HEIGHT = 260

type Bounds = [number, number, number, number]

/** Focusable, selectable item. A ring shows when it is selected or has keyboard focus. */
function Selectable({ item, label, bounds, children }: { item: Item; label: string; bounds: Bounds; children: ReactNode }) {
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selectedId === item.id)
  const [focused, setFocused] = useState(false)
  const [x0, y0, x1, y1] = bounds
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      style={{ cursor: 'pointer', outline: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        select(item.id)
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(item.id)}
    >
      {children}
      {(selected || focused) && (
        <rect
          x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={3}
          fill="none" stroke="var(--select)" strokeWidth={1}
          strokeDasharray={focused && !selected ? undefined : '4 3'}
          vectorEffect="non-scaling-stroke" pointerEvents="none"
        />
      )}
    </g>
  )
}

const position = (i: Item) => (i.type === 'distributed' ? i.start : i.position)

export function BeamView() {
  const beam = useStore((s) => s.beam)
  const result = useStore((s) => s.result)
  const stale = useStore((s) => s.error !== null)
  const showReactions = useStore((s) => s.showReactions)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const x = useXScale()
  const stateOf = (id: string) => (id === selectedId ? 'selected' : 'default')

  const dist = (beam.loads ?? []).filter((l) => l.type === 'distributed')
  const wMax = Math.max(0, ...dist.flatMap((l) => [Math.abs(l.w_start), Math.abs(l.w_end)]))
  const lifts = packLanes(
    dist.map((l) => ({
      id: l.id,
      start: x(l.start),
      end: x(l.end),
      height: Math.max(loadHeight(l.w_start, wMax), loadHeight(l.w_end, wMax)),
    })),
  )
  const x0 = x(0)
  const xL = x(beam.length)

  return (
    <g transform={`translate(0,${BEAM_Y})`}>
      <rect x={0} y={-BEAM_Y} width="100%" height={BEAM_PANEL_HEIGHT} fill="transparent" onPointerDown={() => select(null)} />
      <g transform={`translate(${x0},0)`}>
        <Beam length={xL - x0} />
      </g>
      {[...allItems(beam)].sort((p, q) => position(p) - position(q)).map((item) => {
        const st = stateOf(item.id)
        if (item.type === 'distributed') {
          const h = Math.max(loadHeight(item.w_start, wMax), loadHeight(item.w_end, wMax))
          const lift = lifts.get(item.id) ?? 0
          return (
            <Selectable key={item.id} item={item} bounds={[x(item.start) - 6, -(lift + h + 24), x(item.end) + 6, 2]}
              label={`Distributed load ${item.w_start} to ${item.w_end} kN/m from ${formatQty(item.start, 'm')} to ${formatQty(item.end, 'm')}`}>
              <DistributedLoad xs={x(item.start)} xe={x(item.end)} w1={item.w_start} w2={item.w_end} wMax={wMax} lift={lift} state={st} />
            </Selectable>
          )
        }
        if (item.type === 'point') {
          return (
            <Selectable key={item.id} item={item} bounds={[x(item.position) - 24, -72, x(item.position) + 24, -2]}
              label={`Point load ${Math.abs(item.magnitude)} kN ${item.magnitude < 0 ? 'down' : 'up'} at ${formatQty(item.position, 'm')}`}>
              <PointLoad x={x(item.position)} magnitude={item.magnitude} state={st} />
            </Selectable>
          )
        }
        if (item.type === 'moment') {
          return (
            <Selectable key={item.id} item={item} bounds={[x(item.position) - 26, -38, x(item.position) + 26, 22]}
              label={`Moment ${Math.abs(item.magnitude)} kN·m at ${formatQty(item.position, 'm')}`}>
              <Couple x={x(item.position)} magnitude={item.magnitude} state={st} />
            </Selectable>
          )
        }
        const px = x(item.position)
        const fixed = item.type === 'fixed'
        return (
          <Selectable key={item.id} item={item} bounds={fixed ? [px - 12, -28, px + 12, 28] : [px - 22, -8, px + 22, 36]}
            label={`${item.type} support at ${formatQty(item.position, 'm')}`}>
            {item.type === 'pin' && <PinSupport x={px} state={st} />}
            {item.type === 'roller' && <RollerSupport x={px} state={st} />}
            {fixed && <FixedSupport x={px} end={item.position < beam.length / 2 ? 'left' : 'right'} state={st} />}
          </Selectable>
        )
      })}
      {result && showReactions && (
        <g opacity={stale ? 0.35 : 1}>
          {result.reactions.map((r) => {
            const sup = beam.supports.find((s) => s.id === r.support_id)
            if (!sup) return null
            return (
              <g key={r.support_id}>
                {Math.abs(r.fy) > 1e-9 && <ReactionForce x={x(sup.position)} value={r.fy} />}
                {sup.type === 'fixed' && Math.abs(r.moment) > 1e-9 && (
                  <ReactionMoment x={x(sup.position)} value={r.moment} />
                )}
              </g>
            )
          })}
        </g>
      )}
      <DimensionChain points={keyPoints(beam).map((v) => ({ x: x(v), value: v }))} />
      {beam.supports.length === 0 && (
        <text x={(x0 + xL) / 2} y={36} textAnchor="middle" fontSize={13} fill="var(--ink-2)">
          Add a support from the palette.
        </text>
      )}
    </g>
  )
}
