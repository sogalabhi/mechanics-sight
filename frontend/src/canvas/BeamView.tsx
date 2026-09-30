import type { ReactNode } from 'react'
import {
  Beam, Couple, DimensionChain, DistributedLoad, FixedSupport, PinSupport, PointLoad, RollerSupport,
  loadHeight, ReactionForce, ReactionMoment,
} from '@/drawing'
import { formatQty } from '@/math/format'
import { packLanes } from '@/math/lanes'
import { keyPoints } from '@/model/actions'
import type { Item } from '@/model/types'
import { useStore } from '@/store/store'
import { useXScale } from './XScaleContext'

export const BEAM_Y = 130
export const BEAM_PANEL_HEIGHT = 260

function Selectable({ item, label, children }: { item: Item; label: string; children: ReactNode }) {
  const select = useStore((s) => s.select)
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      style={{ cursor: 'pointer', outline: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        select(item.id)
      }}
      onKeyDown={(e) => e.key === 'Enter' && select(item.id)}
    >
      {children}
    </g>
  )
}

export function BeamView() {
  const beam = useStore((s) => s.beam)
  const result = useStore((s) => s.result)
  const stale = useStore((s) => s.error !== null)
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
      {dist.map((l) => (
        <Selectable key={l.id} item={l} label={`Distributed load ${l.w_start} to ${l.w_end} kN/m from ${formatQty(l.start, 'm')} to ${formatQty(l.end, 'm')}`}>
          <DistributedLoad xs={x(l.start)} xe={x(l.end)} w1={l.w_start} w2={l.w_end} wMax={wMax} lift={lifts.get(l.id) ?? 0} state={stateOf(l.id)} />
        </Selectable>
      ))}
      {beam.supports.map((s) => {
        const label = `${s.type} support at ${formatQty(s.position, 'm')}`
        const st = stateOf(s.id)
        return (
          <Selectable key={s.id} item={s} label={label}>
            {s.type === 'pin' && <PinSupport x={x(s.position)} state={st} />}
            {s.type === 'roller' && <RollerSupport x={x(s.position)} state={st} />}
            {s.type === 'fixed' && <FixedSupport x={x(s.position)} end={s.position < beam.length / 2 ? 'left' : 'right'} state={st} />}
          </Selectable>
        )
      })}
      {(beam.loads ?? []).map((l) =>
        l.type === 'point' ? (
          <Selectable key={l.id} item={l} label={`Point load ${Math.abs(l.magnitude)} kN ${l.magnitude < 0 ? 'down' : 'up'} at ${formatQty(l.position, 'm')}`}>
            <PointLoad x={x(l.position)} magnitude={l.magnitude} state={stateOf(l.id)} />
          </Selectable>
        ) : l.type === 'moment' ? (
          <Selectable key={l.id} item={l} label={`Moment ${Math.abs(l.magnitude)} kN·m at ${formatQty(l.position, 'm')}`}>
            <Couple x={x(l.position)} magnitude={l.magnitude} state={stateOf(l.id)} />
          </Selectable>
        ) : null,
      )}
      {result && (
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
