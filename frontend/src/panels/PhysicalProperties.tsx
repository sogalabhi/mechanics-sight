import { round3, validateBeam } from '@/model/actions'
import type { BeamInput, MaterialInput, PropertySpanInput, SectionInput } from '@/model/types'
import { useStore } from '@/store/store'
import { NumberField } from '@/ui/NumberField'
import ui from '@/ui/ui.module.css'
import styles from './panels.module.css'

const DEFAULT_MATERIAL: MaterialInput = { young_modulus_gpa: 200, yield_strength_mpa: 250 }

const sectionPreset = (type: SectionInput['type']): SectionInput => {
  switch (type) {
    case 'rectangle': return { type, width: 0.2, height: 0.3 }
    case 'circle': return { type, diameter: 0.2 }
    case 'i': return { type, height: 0.3, flange_width: 0.15, flange_thickness: 0.02, web_thickness: 0.01 }
    case 't': return { type, flange_width: 0.15, flange_thickness: 0.02, web_depth: 0.28, web_thickness: 0.01 }
  }
}

export function PhysicalProperties() {
  const beam = useStore((s) => s.beam)
  const commit = useStore((s) => s.commit)
  const isStepped = (beam.spans ?? []).length > 0
  const hasUniform = beam.material != null && beam.section != null
  const enabled = hasUniform || isStepped

  const apply = (patch: Partial<BeamInput>): string | null => {
    const next = { ...beam, ...patch }
    const error = validateBeam(next)
    if (error) return error
    commit(next)
    return null
  }

  const positive = (fn: (value: number) => string | null) => (value: number) =>
    value > 0 ? fn(value) : 'Must be greater than 0'

  const toggleStepped = (stepped: boolean) => {
    if (stepped) {
      const mat = beam.material ?? DEFAULT_MATERIAL
      const sec = beam.section ?? sectionPreset('rectangle')
      apply({
        material: null,
        section: null,
        spans: [{ x_start: 0, x_end: beam.length, material: mat, section: sec }],
      })
    } else {
      const first = beam.spans?.[0]
      apply({
        material: first?.material ?? DEFAULT_MATERIAL,
        section: first?.section ?? sectionPreset('rectangle'),
        spans: [],
      })
    }
  }

  const splitSpan = (index: number) => {
    const spans = [...(beam.spans ?? [])]
    const target = spans[index]
    const mid = round3((target.x_start + target.x_end) / 2)
    if (mid <= target.x_start + 0.01 || mid >= target.x_end - 0.01) return
    const span1: PropertySpanInput = { ...target, x_end: mid }
    const span2: PropertySpanInput = { ...target, x_start: mid }
    spans.splice(index, 1, span1, span2)
    apply({ spans })
  }

  const removeSpan = (index: number) => {
    const spans = [...(beam.spans ?? [])]
    if (spans.length <= 1) return
    if (index === 0) {
      spans[1] = { ...spans[1], x_start: spans[0].x_start }
      spans.shift()
    } else {
      spans[index - 1] = { ...spans[index - 1], x_end: spans[index].x_end }
      spans.splice(index, 1)
    }
    apply({ spans })
  }

  const updateSpan = (index: number, patch: Partial<PropertySpanInput>) => {
    const spans = [...(beam.spans ?? [])]
    spans[index] = { ...spans[index], ...patch }
    apply({ spans })
  }

  return (
    <section aria-labelledby="physical-properties-title">
      <h2 id="physical-properties-title" className={styles.title}>Material & section</h2>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            if (event.target.checked) {
              apply({ material: DEFAULT_MATERIAL, section: sectionPreset('rectangle'), spans: [] })
            } else {
              apply({ material: null, section: null, spans: [] })
            }
          }}
        />
        Enable physical properties
      </label>

      {!enabled ? (
        <p className={styles.hint}>Add E and a section to calculate physical slope, deflection, and stresses.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, margin: '8px 0', fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="prop-mode"
                checked={!isStepped}
                onChange={() => toggleStepped(false)}
              />
              Uniform
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="prop-mode"
                checked={isStepped}
                onChange={() => toggleStepped(true)}
              />
              Stepped (spans)
            </label>
          </div>

          {!isStepped && beam.material && beam.section ? (
            <>
              <NumberField
                label="Young's modulus E"
                unit="GPa"
                value={beam.material.young_modulus_gpa}
                onCommit={positive((value) => apply({ material: { ...beam.material!, young_modulus_gpa: value } }))}
              />
              <NumberField
                label="Yield strength"
                unit="MPa"
                value={beam.material.yield_strength_mpa}
                onCommit={positive((value) => apply({ material: { ...beam.material!, yield_strength_mpa: value } }))}
              />
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Cross-section</span>
                <select
                  className={ui.input}
                  aria-label="Cross-section"
                  value={beam.section.type}
                  onChange={(event) => apply({ section: sectionPreset(event.target.value as SectionInput['type']) })}
                >
                  <option value="rectangle">Rectangle / box</option>
                  <option value="circle">Circle / pipe</option>
                  <option value="i">I-section</option>
                  <option value="t">T-section</option>
                </select>
              </label>
              <SectionFields section={beam.section} onChange={(section) => apply({ section })} />
            </>
          ) : isStepped ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(beam.spans ?? []).map((span, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: 10,
                    background: 'var(--panel)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      Span {idx + 1}: [{span.x_start} m – {span.x_end} m]
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={ui.btn}
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => splitSpan(idx)}
                        title="Split this span into two"
                      >
                        Split
                      </button>
                      {(beam.spans ?? []).length > 1 && (
                        <button
                          className={ui.btn}
                          style={{ padding: '2px 8px', fontSize: 11, color: 'var(--danger)' }}
                          onClick={() => removeSpan(idx)}
                          title="Remove this span and merge with adjacent"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <NumberField
                    label="E"
                    unit="GPa"
                    value={span.material.young_modulus_gpa}
                    onCommit={positive((val) => {
                      updateSpan(idx, { material: { ...span.material, young_modulus_gpa: val } })
                      return null
                    })}
                  />
                  <NumberField
                    label="Yield"
                    unit="MPa"
                    value={span.material.yield_strength_mpa}
                    onCommit={positive((val) => {
                      updateSpan(idx, { material: { ...span.material, yield_strength_mpa: val } })
                      return null
                    })}
                  />
                  <label className={ui.field}>
                    <span className={ui.fieldLabel}>Section</span>
                    <select
                      className={ui.input}
                      value={span.section.type}
                      onChange={(event) =>
                        updateSpan(idx, { section: sectionPreset(event.target.value as SectionInput['type']) })
                      }
                    >
                      <option value="rectangle">Rectangle / box</option>
                      <option value="circle">Circle / pipe</option>
                      <option value="i">I-section</option>
                      <option value="t">T-section</option>
                    </select>
                  </label>
                  <SectionFields
                    section={span.section}
                    onChange={(section) => {
                      updateSpan(idx, { section })
                      return null
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function SectionFields({ section, onChange }: { section: SectionInput; onChange: (section: SectionInput) => string | null }) {
  const field = (label: string, key: string, value: number) => (
    <NumberField
      key={key}
      label={label}
      unit="m"
      step={0.001}
      value={value}
      onCommit={(next) => next > 0 ? onChange({ ...section, [key]: next } as SectionInput) : 'Must be greater than 0'}
    />
  )
  if (section.type === 'rectangle') {
    return <>
      {field('Width', 'width', section.width)}
      {field('Height', 'height', section.height)}
      <HollowToggle
        checked={section.wall_thickness != null}
        onChange={(checked) => onChange({ ...section, wall_thickness: checked ? 0.01 : null })}
      />
      {section.wall_thickness != null && field('Wall thickness', 'wall_thickness', section.wall_thickness)}
    </>
  }
  if (section.type === 'circle') {
    return <>
      {field('Diameter', 'diameter', section.diameter)}
      <HollowToggle
        checked={section.wall_thickness != null}
        onChange={(checked) => onChange({ ...section, wall_thickness: checked ? 0.01 : null })}
      />
      {section.wall_thickness != null && field('Wall thickness', 'wall_thickness', section.wall_thickness)}
    </>
  }
  if (section.type === 'i') {
    return <>
      {field('Total height', 'height', section.height)}
      {field('Flange width', 'flange_width', section.flange_width)}
      {field('Flange thickness', 'flange_thickness', section.flange_thickness)}
      {field('Web thickness', 'web_thickness', section.web_thickness)}
    </>
  }
  return <>
    {field('Flange width', 'flange_width', section.flange_width)}
    {field('Flange thickness', 'flange_thickness', section.flange_thickness)}
    {field('Web depth', 'web_depth', section.web_depth)}
    {field('Web thickness', 'web_thickness', section.web_thickness)}
  </>
}

function HollowToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      Hollow section
    </label>
  )
}
