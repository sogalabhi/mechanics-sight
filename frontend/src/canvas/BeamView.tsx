import { useState, type ReactNode } from 'react'
import {
  Beam, Couple, DimensionChain, DistributedLoad, FixedSupport, Hinge, PinSupport, PointLoad, RollerSupport,
  loadHeight, ReactionForce, ReactionAxialForce, ReactionMoment,
} from '@/drawing'
import { formatNumber, formatQty } from '@/math/format'
import { packLanes } from '@/math/lanes'
import { allItems, keyPoints } from '@/model/actions'
import type { Item } from '@/model/types'
import { useStore } from '@/store/store'
import { useXScale } from './xscale'
import { useBeamDrag } from './useBeamDrag'

export const BEAM_Y = 130
export const BEAM_PANEL_HEIGHT = 260

type Bounds = [number, number, number, number]

/** Focusable, selectable item. A ring shows when it is selected or has keyboard focus. */
function Selectable({ item, label, bounds, children }: { item: Item; label: string; bounds: Bounds; children: ReactNode }) {
  const { startDrag } = useBeamDrag()
  const selected = useStore((s) => s.selectedId === item.id)
  const dragging = useStore((s) => s.draft !== null && s.selectedId === item.id)
  const [focused, setFocused] = useState(false)
  const [x0, y0, x1, y1] = bounds
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      data-item-id={item.id}
      style={{ cursor: dragging ? 'grabbing' : item.type === 'fixed' ? 'pointer' : 'grab', outline: 'none', touchAction: 'none' }}
      onPointerDown={(e) => {
        startDrag(e, { item })
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useStore.getState().select(item.id) } }}
    >
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" />
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
  const beam = useStore((s) => s.draft ?? s.beam)
  const result = useStore((s) => s.result)
  const stale = useStore((s) => s.error !== null)
  const showReactions = useStore((s) => s.showReactions)
  const sawCutX = useStore((s) => s.sawCutX)
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
  const { startDrag } = useBeamDrag()
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
              {selectedId === item.id && (['start', 'end'] as const).map((part) => (
                <g key={part} role="button" aria-label={`Resize load ${part}`} data-resize={part}
                  style={{ cursor: 'ew-resize', touchAction: 'none' }}
                  onPointerDown={(e) => startDrag(e, { item, part })}>
                  <rect x={x(item[part]) - 10} y={-lift - h - 10} width={20} height={h + 20} fill="transparent" />
                  <circle cx={x(item[part])} cy={-lift - h} r={5} fill="var(--paper)" stroke="var(--select)" strokeWidth={2} />
                </g>
              ))}
            </Selectable>
          )
        }
        if (item.type === 'point') {
          const fx = item.fx ?? 0
          const desc =
            Math.abs(fx) > 1e-6
              ? `Point load ${formatNumber(Math.hypot(fx, item.magnitude))} kN at ${formatQty(item.position, 'm')}`
              : `Point load ${Math.abs(item.magnitude)} kN ${item.magnitude < 0 ? 'down' : 'up'} at ${formatQty(item.position, 'm')}`
          return (
            <Selectable key={item.id} item={item} bounds={[x(item.position) - 36, -72, x(item.position) + 36, 8]}
              label={desc}>
              <PointLoad x={x(item.position)} magnitude={item.magnitude} fx={fx} state={st} />
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
        if (item.type === 'hinge') {
          const px = x(item.position)
          return (
            <Selectable key={item.id} item={item} bounds={[px - 10, -10, px + 10, 10]}
              label={`Internal hinge at ${formatQty(item.position, 'm')}`}>
              <Hinge x={px} state={st} />
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
        <g opacity={stale ? 0.35 : 1} pointerEvents="none">
          {result.reactions.map((r) => {
            const sup = beam.supports.find((s) => s.id === r.support_id)
            if (!sup) return null
            return (
              <g key={r.support_id}>
                {Math.abs(r.fy) > 1e-9 && <ReactionForce x={x(sup.position)} value={r.fy} />}
                {Math.abs(r.fx) > 1e-9 && <ReactionAxialForce x={x(sup.position)} value={r.fx} />}
                {sup.type === 'fixed' && Math.abs(r.moment) > 1e-9 && (
                  <ReactionMoment x={x(sup.position)} value={r.moment} />
                )}
              </g>
            )
          })}
        </g>
      )}
      <DimensionChain points={keyPoints(beam).map((v) => ({ x: x(v), value: v }))} />
      {/* Virtual Saw Section Cut Graphic */}
      {sawCutX !== null && sawCutX > 1e-4 && sawCutX < beam.length - 1e-4 && (
        <g pointerEvents="none">
          {/* Dim the right side of the beam to isolate the left segment */}
          <rect
            x={x(sawCutX)}
            y={-BEAM_Y}
            width={Math.max(0, xL - x(sawCutX) + 60)}
            height={BEAM_PANEL_HEIGHT}
            fill="var(--paper)"
            fillOpacity={0.62}
          />
          {/* Jagged Saw Cut Line */}
          <path
            d={`M${x(sawCutX)},-22 L${x(sawCutX) + 3.5},-11 L${x(sawCutX) - 3.5},0 L${x(sawCutX) + 3.5},11 L${x(sawCutX)},22`}
            stroke="var(--cut)"
            strokeWidth={2.4}
            fill="none"
          />
          <rect
            x={x(sawCutX) - 48}
            y={-40}
            width={96}
            height={16}
            rx={3}
            fill="var(--panel)"
            stroke="var(--cut)"
            strokeWidth={1}
            opacity={0.94}
          />
          <text
            x={x(sawCutX)}
            y={-28}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={9.5}
            fontWeight={600}
            fill="var(--cut)"
          >
            🪚 Cut x = {formatNumber(sawCutX)} m
          </text>
        </g>
      )}
      {beam.supports.length === 0 && (
        <text x={(x0 + xL) / 2} y={36} textAnchor="middle" fontSize={13} fill="var(--ink-2)">
          Add a support from the palette.
        </text>
      )}
    </g>
  )
}
