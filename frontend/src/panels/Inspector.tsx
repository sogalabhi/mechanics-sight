import { useState } from 'react'
import { gridStep } from '@/math/snap'
import { findItem, removeItem, round3, updateItem, validateBeam } from '@/model/actions'
import type { Item } from '@/model/types'
import { useStore } from '@/store/store'
import { NumberField } from '@/ui/NumberField'
import { Segmented } from '@/ui/Segmented'
import styles from './panels.module.css'

function typeName(i: Item): string {
  switch (i.type) {
    case 'pin': return 'Pin support'
    case 'roller': return 'Roller support'
    case 'fixed': return 'Fixed support'
    case 'hinge': return 'Internal hinge'
    case 'point': return 'Point load'
    case 'moment': return 'Moment'
    case 'distributed':
      if (i.w_start === i.w_end) return 'UDL'
      return i.w_start === 0 || i.w_end === 0 ? 'UVL' : 'Trapezoidal'
  }
}

export function Inspector({ compact = false }: { compact?: boolean }) {
  const beam = useStore((s) => s.draft ?? s.beam)
  const id = useStore((s) => s.selectedId)
  const commit = useStore((s) => s.commit)
  const [fromRight, setFromRight] = useState(false)
  const item = id ? findItem(beam, id) : undefined

  if (!item) return (
    <div>
      <h2 className={styles.title}>Inspector</h2>
      <p className={styles.hint}>Select an item on the beam to edit it.</p>
    </div>
  )

  const L = beam.length
  const apply = (patch: object): string | null => {
    const next = updateItem(beam, item.id, patch)
    const err = validateBeam(next)
    if (err) return err
    commit(next)
    return null
  }
  const pos = (label: string, get: number, key: string) => (
    <NumberField
      label={label}
      unit="m"
      step={gridStep(L)}
      value={fromRight ? round3(L - get) : get}
      onCommit={(v) => apply({ [key]: round3(fromRight ? L - v : v) })}
    />
  )
  const positive = (fn: (v: number) => string | null) => (v: number) => (v > 0 ? fn(v) : 'Must be greater than 0')

  return (
    <div>
      {compact ? (
        <p className={styles.itemName}>{typeName(item)}</p>
      ) : (
        <>
          <h2 className={styles.title}>{typeName(item)}</h2>
          <button className={styles.del} onClick={() => commit(removeItem(beam, item.id), null)}>Delete</button>
        </>
      )}
      <Segmented
        label="Measure from"
        value={fromRight ? 'right' : 'left'}
        options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
        onChange={(v) => setFromRight(v === 'right')}
      />
      {item.type === 'distributed' ? (
        <>
          {pos('Start', item.start, 'start')}
          {pos('End', item.end, 'end')}
          <Segmented
            label="Direction"
            value={(item.w_start !== 0 ? item.w_start : item.w_end) < 0 ? 'down' : 'up'}
            options={[{ value: 'down', label: '↓ Down' }, { value: 'up', label: '↑ Up' }]}
            onChange={(d) => {
              const s = d === 'down' ? -1 : 1
              apply({ w_start: Math.abs(item.w_start) * s, w_end: Math.abs(item.w_end) * s })
            }}
          />
          {(['w_start', 'w_end'] as const).map((k) => (
            <NumberField
              key={k}
              label={k === 'w_start' ? 'Intensity at start' : 'Intensity at end'}
              unit="kN/m"
              value={Math.abs(item[k])}
              onCommit={(v) => {
                if (v < 0) return 'Must not be negative'
                const s = (item.w_start !== 0 ? item.w_start : item.w_end) < 0 ? -1 : 1
                return apply({ [k]: v * s })
              }}
            />
          ))}
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={item.w_start === item.w_end}
              onChange={(e) => e.target.checked && apply({ w_end: item.w_start })}
            />
            Uniform
          </label>
        </>
      ) : (
        <>
          {pos('Position', item.position, 'position')}
          {item.type === 'point' && (
            <>
              <Segmented
                label="Vertical"
                value={item.magnitude < 0 ? 'down' : 'up'}
                options={[{ value: 'down', label: '↓ Down' }, { value: 'up', label: '↑ Up' }]}
                onChange={(d) => apply({ magnitude: Math.abs(item.magnitude) * (d === 'down' ? -1 : 1) })}
              />
              <NumberField label="Fy" unit="kN" value={Math.abs(item.magnitude)}
                onCommit={positive((v) => apply({ magnitude: v * (item.magnitude < 0 ? -1 : 1) }))} />
              <Segmented
                label="Horizontal"
                value={(item.fx ?? 0) >= 0 ? 'right' : 'left'}
                options={[{ value: 'right', label: '→ Right' }, { value: 'left', label: '← Left' }]}
                onChange={(d) => {
                  const mag = Math.abs(item.fx ?? 0) || 0
                  apply({ fx: mag * (d === 'left' ? -1 : 1) })
                }}
              />
              <NumberField label="Fx" unit="kN" value={Math.abs(item.fx ?? 0)}
                onCommit={(v) => apply({ fx: v * ((item.fx ?? 0) < 0 ? -1 : 1) })} />
            </>
          )}
          {item.type === 'moment' && (
            <>
              <Segmented
                label="Direction"
                value={item.magnitude > 0 ? 'ccw' : 'cw'}
                options={[{ value: 'ccw', label: '↺ Anticlockwise' }, { value: 'cw', label: '↻ Clockwise' }]}
                onChange={(d) => apply({ magnitude: Math.abs(item.magnitude) * (d === 'ccw' ? 1 : -1) })}
              />
              <NumberField label="Magnitude" unit="kN·m" value={Math.abs(item.magnitude)}
                onCommit={positive((v) => apply({ magnitude: v * (item.magnitude > 0 ? 1 : -1) }))} />
            </>
          )}
          {item.type === 'hinge' && (
            <p className={styles.hint} style={{ marginTop: '0.75rem', fontSize: '0.75rem', lineHeight: 1.4 }}>
              Releases bending moment (<em>M</em> = 0) while transmitting vertical shear force (<em>V</em>).
            </p>
          )}
        </>
      )}
    </div>
  )
}
