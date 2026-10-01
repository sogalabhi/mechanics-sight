import { useState } from 'react'
import { formatNumber } from '@/math/format'
import { gridStep } from '@/math/snap'
import { findItem, removeItem, round3, setLength, updateItem, validateBeam } from '@/model/actions'
import { isSupport, type Item } from '@/model/types'
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
    case 'point': {
      const hasFx = Math.abs(i.fx ?? 0) > 1e-6
      const hasFy = Math.abs(i.magnitude) > 1e-6
      if (hasFx && hasFy) return 'Inclined point load'
      if (hasFx) return 'Horizontal point load'
      return 'Point load'
    }
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
      <h2 className={styles.title}>Beam Properties</h2>
      <NumberField
        label="Beam Length"
        unit="m"
        step={0.5}
        value={beam.length}
        onCommit={(v) => {
          if (v <= 0) return 'Must be greater than 0'
          const next = setLength(beam, v)
          const err = validateBeam(next)
          if (err) return err
          commit(next)
          return next.length !== v ? `Adjusted to ${next.length} m` : null
        }}
      />
      <div className={styles.hint} style={{ marginTop: 12, fontSize: 12 }}>
        <p style={{ margin: '4px 0' }}>Supports: {beam.supports.length}</p>
        <p style={{ margin: '4px 0' }}>Loads: {(beam.loads ?? []).length}</p>
        {(beam.hinges?.length ?? 0) > 0 && <p style={{ margin: '4px 0' }}>Hinges: {beam.hinges?.length}</p>}
      </div>
      <p className={styles.hint} style={{ marginTop: 16 }}>
        Select an item on the beam to edit its position and properties.
      </p>
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
          {item.type === 'point' && (() => {
            const fx = item.fx ?? 0
            const fy = item.magnitude
            const absFx = Math.abs(fx)
            const absFy = Math.abs(fy)
            const hasFx = absFx > 1e-6
            const hasFy = absFy > 1e-6
            const mode = hasFx && hasFy ? 'inclined' : hasFx ? 'horizontal' : 'vertical'
            const hypot = Math.hypot(absFx, absFy)
            const deg = hypot > 1e-6 ? round3((Math.atan2(absFy, absFx) * 180) / Math.PI) : 90

            return (
              <>
                <Segmented
                  label="Load orientation"
                  value={mode}
                  options={[
                    { value: 'vertical', label: 'Vertical' },
                    { value: 'horizontal', label: 'Horizontal' },
                    { value: 'inclined', label: 'Inclined' },
                  ]}
                  onChange={(m) => {
                    if (m === 'vertical') {
                      apply({ fx: 0, magnitude: fy !== 0 ? fy : -10 })
                    } else if (m === 'horizontal') {
                      apply({ magnitude: 0, fx: fx !== 0 ? fx : 10 })
                    } else {
                      apply({
                        fx: fx !== 0 ? fx : 10,
                        magnitude: fy !== 0 ? fy : -10,
                      })
                    }
                  }}
                />

                {mode !== 'horizontal' && (
                  <>
                    <Segmented
                      label="Vertical direction"
                      value={fy < 0 ? 'down' : 'up'}
                      options={[{ value: 'down', label: '↓ Down' }, { value: 'up', label: '↑ Up' }]}
                      onChange={(d) => apply({ magnitude: Math.abs(fy || 10) * (d === 'down' ? -1 : 1) })}
                    />
                    <NumberField
                      label={mode === 'inclined' ? 'Vertical component |Fy|' : 'Magnitude |Fy|'}
                      unit="kN"
                      value={absFy}
                      onCommit={(v) => {
                        if (v < 0) return 'Must not be negative'
                        if (v === 0 && mode === 'vertical') return 'Vertical load cannot be 0'
                        if (v === 0 && absFx === 0) return 'Load cannot be 0'
                        return apply({ magnitude: v * (fy < 0 ? -1 : 1) })
                      }}
                    />
                  </>
                )}

                {mode !== 'vertical' && (
                  <>
                    <Segmented
                      label="Horizontal direction"
                      value={fx >= 0 ? 'right' : 'left'}
                      options={[{ value: 'right', label: '→ Right' }, { value: 'left', label: '← Left' }]}
                      onChange={(d) => {
                        const mag = Math.abs(fx || 10) || 10
                        apply({ fx: mag * (d === 'left' ? -1 : 1) })
                      }}
                    />
                    <NumberField
                      label={mode === 'inclined' ? 'Horizontal component |Fx|' : 'Magnitude |Fx|'}
                      unit="kN"
                      value={absFx}
                      onCommit={(v) => {
                        if (v < 0) return 'Must not be negative'
                        if (v === 0 && mode === 'horizontal') return 'Horizontal load cannot be 0'
                        if (v === 0 && absFy === 0) return 'Load cannot be 0'
                        return apply({ fx: v * (fx < 0 ? -1 : 1) })
                      }}
                    />
                  </>
                )}

                {mode === 'inclined' && (
                  <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--grid)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                    <strong>Resultant:</strong> {formatNumber(hypot)} kN at {deg}° to horizontal
                  </div>
                )}
              </>
            )
          })()}
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
          {isSupport(item) && (
            <>
              <NumberField
                label="Settlement (downward)"
                unit="mm"
                step={1}
                value={round3((item.settlement ?? 0) * 1000)}
                onCommit={(v) => {
                  if (!Number.isFinite(v)) return 'Invalid number'
                  return apply({ settlement: round3(v / 1000) })
                }}
              />
              <NumberField
                label="Spring ky"
                unit="kN/m"
                step={100}
                value={item.spring_ky ?? 0}
                onCommit={(v) => {
                  if (v < 0) return 'Must not be negative'
                  return apply({ spring_ky: v > 0 ? v : null })
                }}
              />
              {item.type === 'fixed' && (
                <NumberField
                  label="Spring kθ"
                  unit="kN·m/rad"
                  step={100}
                  value={item.spring_ktheta ?? 0}
                  onCommit={(v) => {
                    if (v < 0) return 'Must not be negative'
                    return apply({ spring_ktheta: v > 0 ? v : null })
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
