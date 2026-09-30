import { useMemo } from 'react'
import { formatNumber, formatQty } from '@/math/format'
import { computeSectionCut } from '@/math/sectionCut'
import { computeStressProfile } from '@/math/stressProfile'
import { useStore } from '@/store/store'
import styles from './VirtualSawCard.module.css'

export function VirtualSawCard() {
  const sawCutX = useStore((s) => s.sawCutX)
  const beam = useStore((s) => s.draft ?? s.beam)
  const result = useStore((s) => s.result)
  const setSawCutX = useStore((s) => s.setSawCutX)

  const data = useMemo(() => {
    if (sawCutX === null || !result) return null
    return computeSectionCut(beam, result, sawCutX)
  }, [sawCutX, beam, result])

  const activeSection = useMemo(() => {
    if (sawCutX === null) return null
    if (beam.spans && beam.spans.length > 0) {
      const sp = beam.spans.find((s) => s.x_start - 1e-6 <= sawCutX && sawCutX <= s.x_end + 1e-6)
      return sp?.section ?? null
    }
    return beam.section ?? null
  }, [sawCutX, beam])

  const stressProfile = useMemo(() => {
    if (!activeSection || !data) return null
    return computeStressProfile(activeSection, data.mCut, data.vCut)
  }, [activeSection, data])

  if (!data) return null

  // Mini-FBD SVG dimensions
  const fbdW = 420
  const fbdH = 120
  const xOrigin = 35
  const xCutPx = 330
  const beamY = 62
  const beamH = 14

  const toPx = (m: number) => xOrigin + (m / data.xCut) * (xCutPx - xOrigin)

  const vMatches = Math.abs(data.vCut - data.vDiagram) < 1e-4
  const mMatches = Math.abs(data.mCut - data.mDiagram) < 1e-4

  return (
    <aside className={styles.card} aria-label="Virtual Saw Free Body Cut">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Virtual Saw Cut</span>
          <span className={styles.badge}>x = {formatNumber(data.xCut)} m</span>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setSawCutX(null)}
          title="Close section cut (Esc)"
          aria-label="Close section cut"
        >
          ×
        </button>
      </div>

      <div className={styles.intro}>
        The <strong>Method of Sections</strong> isolates the left segment [0, {formatNumber(data.xCut)} m].
        The exposed cut face must provide internal balancing forces to satisfy static equilibrium.
      </div>

      {/* Mini Free Body Diagram Canvas */}
      <div className={styles.fbdBox}>
        <div className={styles.fbdTitle}>Free Body Diagram (FBD) of Left Segment</div>
        <svg width={fbdW} height={fbdH} viewBox={`0 0 ${fbdW} ${fbdH}`} style={{ display: 'block' }}>
          {/* Dimension line at bottom */}
          <line x1={xOrigin} x2={xCutPx} y1={fbdH - 12} y2={fbdH - 12} stroke="var(--ink-2)" strokeWidth={1} />
          <line x1={xOrigin} x2={xOrigin} y1={fbdH - 16} y2={fbdH - 8} stroke="var(--ink-2)" strokeWidth={1} />
          <line x1={xCutPx} x2={xCutPx} y1={fbdH - 16} y2={fbdH - 8} stroke="var(--ink-2)" strokeWidth={1} />
          <text
            x={(xOrigin + xCutPx) / 2}
            y={fbdH - 3}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={9.5}
            fill="var(--ink-2)"
          >
            x = {formatNumber(data.xCut)} m
          </text>

          {/* Sliced Beam Body */}
          <rect
            x={xOrigin}
            y={beamY}
            width={xCutPx - xOrigin}
            height={beamH}
            fill="var(--panel)"
            stroke="var(--ink)"
            strokeWidth={1.5}
          />

          {/* Left origin marker (x = 0) */}
          <line x1={xOrigin} x2={xOrigin} y1={beamY - 4} y2={beamY + beamH + 4} stroke="var(--ink-2)" strokeWidth={1} />

          {/* Reactions to the left of the cut */}
          {data.reactions.map((r) => {
            const rx = toPx(r.x)
            const up = r.fy > 0
            return (
              <g key={r.id}>
                {up ? (
                  <path d={`M${rx},${beamY + beamH + 26} L${rx},${beamY + beamH + 2} M${rx - 4},${beamY + beamH + 8} L${rx},${beamY + beamH + 2} L${rx + 4},${beamY + beamH + 8}`} stroke="var(--reaction)" strokeWidth={1.8} fill="none" />
                ) : (
                  <path d={`M${rx},${beamY + beamH + 2} L${rx},${beamY + beamH + 26} M${rx - 4},${beamY + beamH + 20} L${rx},${beamY + beamH + 26} L${rx + 4},${beamY + beamH + 20}`} stroke="var(--reaction)" strokeWidth={1.8} fill="none" />
                )}
                <text
                  x={rx}
                  y={beamY + beamH + 36}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={9}
                  fill="var(--reaction)"
                  fontWeight={600}
                >
                  {formatNumber(Math.abs(r.fy))} kN
                </text>
              </g>
            )
          })}

          {/* Fixed support wall reaction moments */}
          {data.reactionMoments.map((m) => {
            const mx = toPx(m.x)
            return (
              <g key={m.id}>
                <path
                  d={`M${mx - 10},${beamY - 14} A14,14 0 0,1 ${mx + 12},${beamY - 6}`}
                  stroke="var(--reaction)"
                  strokeWidth={1.5}
                  fill="none"
                />
                <text x={mx} y={beamY - 20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--reaction)">
                  M_wall = {formatNumber(Math.abs(m.magnitude))}
                </text>
              </g>
            )
          })}

          {/* External Point Loads */}
          {data.pointLoads.map((p) => {
            const px = toPx(p.x)
            const down = p.fy < 0
            return (
              <g key={p.id}>
                {down ? (
                  <path d={`M${px},${beamY - 26} L${px},${beamY - 2} M${px - 4},${beamY - 8} L${px},${beamY - 2} L${px + 4},${beamY - 8}`} stroke="var(--load)" strokeWidth={1.8} fill="none" />
                ) : (
                  <path d={`M${px},${beamY - 2} L${px},${beamY - 26} M${px - 4},${beamY - 20} L${px},${beamY - 26} L${px + 4},${beamY - 20}`} stroke="var(--load)" strokeWidth={1.8} fill="none" />
                )}
                <text
                  x={px}
                  y={beamY - 30}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={9}
                  fill="var(--load)"
                  fontWeight={600}
                >
                  {formatNumber(Math.abs(p.fy))} kN
                </text>
              </g>
            )
          })}

          {/* External Distributed Loads (clamped slice) */}
          {data.distributedLoads.map((d) => {
            const x1 = toPx(d.xStart)
            const x2 = toPx(d.xEnd)
            const w = x2 - x1
            return (
              <g key={d.id}>
                <rect x={x1} y={beamY - 14} width={w} height={14} fill="var(--load)" fillOpacity={0.18} stroke="var(--load)" strokeWidth={1} />
                <text x={(x1 + x2) / 2} y={beamY - 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--load)">
                  {formatNumber(Math.abs(d.resultantFy))} kN
                </text>
              </g>
            )
          })}

          {/* Cut Face Section Indicator (Saw Cut) */}
          <path
            d={`M${xCutPx},${beamY - 10} L${xCutPx + 3},${beamY - 2} L${xCutPx - 3},${beamY + 6} L${xCutPx + 3},${beamY + beamH - 2} L${xCutPx},${beamY + beamH + 10}`}
            stroke="#d97706"
            strokeWidth={2}
            fill="none"
          />

          {/* Exposed Internal Shear Vector V_cut */}
          <g transform={`translate(${xCutPx + 14}, 0)`}>
            {data.vCut >= 0 ? (
              <path d={`M0,${beamY} L0,${beamY + 28} M-3.5,${beamY + 21} L0,${beamY + 28} L3.5,${beamY + 21}`} stroke="var(--shear)" strokeWidth={2} fill="none" />
            ) : (
              <path d={`M0,${beamY + 28} L0,${beamY} M-3.5,${beamY + 7} L0,${beamY} L3.5,${beamY + 7}`} stroke="var(--shear)" strokeWidth={2} fill="none" />
            )}
            <text x={8} y={beamY + 18} fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={700} fill="var(--shear)">
              V = {formatQty(data.vCut, 'kN')}
            </text>
          </g>

          {/* Exposed Internal Bending Moment Vector M_cut */}
          <g transform={`translate(${xCutPx + 8}, ${beamY + beamH / 2})`}>
            {data.mCut >= 0 ? (
              // Anticlockwise arc (sagging positive)
              <path d="M12,-16 A18,18 0 0,0 12,16 M8,12 L12,16 L16,11" stroke="var(--moment)" strokeWidth={2} fill="none" />
            ) : (
              // Clockwise arc (hogging negative)
              <path d="M12,16 A18,18 0 0,0 12,-16 M8,-12 L12,-16 L16,-11" stroke="var(--moment)" strokeWidth={2} fill="none" />
            )}
            <text x={26} y={4} fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={700} fill="var(--moment)">
              M = {formatQty(data.mCut, 'kN·m')}
            </text>
          </g>
        </svg>
      </div>

      {/* Static Equilibrium Step-by-Step Proof */}
      <div className={styles.equations}>
        {/* 1. Vertical Force Balance */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span>Vertical Force Balance (Σ Fy = 0)</span>
            {vMatches && (
              <span className={styles.checkBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8.5L6.5 11L12 5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Matches SFD
              </span>
            )}
          </div>

          <div className={styles.termList}>
            {data.reactions.map((r) => (
              <div key={r.id} className={styles.termRow}>
                <span>Reactions: {r.label} (upward)</span>
                <span className={styles.termPositive}>+{formatNumber(r.fy)} kN</span>
              </div>
            ))}
            {data.pointLoads.map((p) => (
              <div key={p.id} className={styles.termRow}>
                <span>Applied Loads: {p.label}</span>
                <span className={styles.termNegative}>{formatNumber(p.fy)} kN</span>
              </div>
            ))}
            {data.distributedLoads.map((d) => (
              <div key={d.id} className={styles.termRow}>
                <span>Applied Loads: {d.label} [0 → {formatNumber(d.xEnd)} m]</span>
                <span className={styles.termNegative}>{formatNumber(d.resultantFy)} kN</span>
              </div>
            ))}
            {data.reactions.length === 0 && data.pointLoads.length === 0 && data.distributedLoads.length === 0 && (
              <div className={styles.termRow}>
                <span>No external vertical forces to left of cut</span>
                <span>0.000 kN</span>
              </div>
            )}
          </div>

          <div className={styles.resultRow}>
            <span>Balancing Internal Shear V_cut:</span>
            <span className={styles.resultShear}>{formatQty(data.vCut, 'kN', { sign: true })}</span>
          </div>
        </div>

        {/* 2. Moment Balance about Cut Face */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span>Moment Balance About Cut Face (Σ M_cut = 0)</span>
            {mMatches && (
              <span className={styles.checkBadge}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8.5L6.5 11L12 5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Matches BMD
              </span>
            )}
          </div>

          <div className={styles.termList}>
            {data.reactions.map((r) => (
              <div key={r.id} className={styles.termRow}>
                <span>{r.label} × ({formatNumber(r.leverArm)} m arm)</span>
                <span className={r.momentAboutCut >= 0 ? styles.termPositive : styles.termNegative}>
                  {r.momentAboutCut >= 0 ? '+' : ''}{formatNumber(r.momentAboutCut)} kN·m
                </span>
              </div>
            ))}
            {data.reactionMoments.map((m) => (
              <div key={m.id} className={styles.termRow}>
                <span>{m.label}</span>
                <span className={m.momentAboutCut >= 0 ? styles.termPositive : styles.termNegative}>
                  {m.momentAboutCut >= 0 ? '+' : ''}{formatNumber(m.momentAboutCut)} kN·m
                </span>
              </div>
            ))}
            {data.pointLoads.map((p) => (
              <div key={p.id} className={styles.termRow}>
                <span>{p.label} × ({formatNumber(p.leverArm)} m arm)</span>
                <span className={p.momentAboutCut >= 0 ? styles.termPositive : styles.termNegative}>
                  {p.momentAboutCut >= 0 ? '+' : ''}{formatNumber(p.momentAboutCut)} kN·m
                </span>
              </div>
            ))}
            {data.distributedLoads.map((d) => (
              <div key={d.id} className={styles.termRow}>
                <span>{d.label} × ({formatNumber(d.leverArm)} m arm to centroid)</span>
                <span className={d.momentAboutCut >= 0 ? styles.termPositive : styles.termNegative}>
                  {d.momentAboutCut >= 0 ? '+' : ''}{formatNumber(d.momentAboutCut)} kN·m
                </span>
              </div>
            ))}
            {data.couples.map((c) => (
              <div key={c.id} className={styles.termRow}>
                <span>{c.label} (applied moment)</span>
                <span className={c.momentAboutCut >= 0 ? styles.termPositive : styles.termNegative}>
                  {c.momentAboutCut >= 0 ? '+' : ''}{formatNumber(c.momentAboutCut)} kN·m
                </span>
              </div>
            ))}
          </div>

          <div className={styles.resultRow}>
            <span>Balancing Internal Moment M_cut:</span>
            <span className={styles.resultMoment}>{formatQty(data.mCut, 'kN·m', { sign: true })}</span>
          </div>
        </div>
      </div>

      {/* 3. Through-Depth Cross-Section Stresses */}
      {stressProfile && (
        <div className={styles.section} style={{ marginTop: 4 }}>
          <div className={styles.sectionHead}>
            <span>Through-Depth Cross-Section Stresses (σ & τ)</span>
            <span className={styles.badge} style={{ textTransform: 'capitalize' }}>
              {stressProfile.section.type} section
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, margin: '8px 0', alignItems: 'center' }}>
            <svg
              width={160}
              height={90}
              viewBox="0 0 160 90"
              style={{ background: 'var(--paper)', borderRadius: 4, border: '1px solid var(--rule)' }}
            >
              <line x1={8} x2={152} y1={45} y2={45} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 2" />
              <text x={10} y={42} fontSize={7.5} fill="var(--ink-2)" fontFamily="var(--font-mono)">NA (y=0)</text>

              {(() => {
                const maxSig = Math.max(1, Math.abs(stressProfile.sigmaTop), Math.abs(stressProfile.sigmaBottom))
                const xTop = 80 + (stressProfile.sigmaTop / maxSig) * 35
                const xBot = 80 + (stressProfile.sigmaBottom / maxSig) * 35
                return (
                  <g>
                    <line x1={80} x2={80} y1={12} y2={78} stroke="var(--ink-2)" strokeWidth={1} />
                    <line x1={xTop} x2={xBot} y1={12} y2={78} stroke="var(--moment, #d97706)" strokeWidth={1.8} />
                    <line x1={80} x2={xTop} y1={12} y2={12} stroke="var(--moment, #d97706)" strokeWidth={1} />
                    <line x1={80} x2={xBot} y1={78} y2={78} stroke="var(--moment, #d97706)" strokeWidth={1} />
                    <text
                      x={xTop >= 80 ? xTop + 3 : xTop - 3}
                      y={15}
                      fontSize={7.5}
                      textAnchor={xTop >= 80 ? 'start' : 'end'}
                      fill="var(--moment, #d97706)"
                      fontFamily="var(--font-mono)"
                    >
                      σ_top
                    </text>
                    <text
                      x={xBot >= 80 ? xBot + 3 : xBot - 3}
                      y={81}
                      fontSize={7.5}
                      textAnchor={xBot >= 80 ? 'start' : 'end'}
                      fill="var(--moment, #d97706)"
                      fontFamily="var(--font-mono)"
                    >
                      σ_bot
                    </text>
                  </g>
                )
              })()}
            </svg>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5 }}>
              <div>
                <span style={{ color: 'var(--ink-2)' }}>Top fibre (σ): </span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatNumber(stressProfile.sigmaTop / 1000, { sign: true })} MPa
                </strong>
                <span
                  style={{
                    fontSize: 9,
                    marginLeft: 4,
                    color: stressProfile.sigmaTop > 0 ? 'var(--axial, #2563eb)' : 'var(--danger, #ef4444)',
                  }}
                >
                  ({stressProfile.sigmaTop > 0 ? 'Tension' : 'Compression'})
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-2)' }}>Bottom fibre (σ): </span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatNumber(stressProfile.sigmaBottom / 1000, { sign: true })} MPa
                </strong>
                <span
                  style={{
                    fontSize: 9,
                    marginLeft: 4,
                    color: stressProfile.sigmaBottom > 0 ? 'var(--axial, #2563eb)' : 'var(--danger, #ef4444)',
                  }}
                >
                  ({stressProfile.sigmaBottom > 0 ? 'Tension' : 'Compression'})
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-2)' }}>Max shear (τ_max): </span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatNumber(stressProfile.tauMax / 1000)} MPa
                </strong>
                <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--ink-2)' }}>(at NA)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Physical Fiber Insight */}
      <div
        className={`${styles.insightBox} ${
          data.isSagging ? styles.insightSagging : data.isHogging ? styles.insightHogging : ''
        }`}
      >
        {data.isSagging ? (
          <>
            <strong>Sagging Curvature (Smiling ⌣):</strong> External clockwise moments bend the beam downward.
            The internal resisting moment compresses the top face and stretches the bottom face (rebar required at the bottom).
          </>
        ) : data.isHogging ? (
          <>
            <strong>Hogging Curvature (Frowning ⌢):</strong> External anticlockwise moments curl the beam over the support.
            The internal resisting moment stretches the top face and compresses the bottom face (top rebar required).
          </>
        ) : (
          <>
            <strong>Point of Contraflexure / Zero Moment:</strong> The net external moment about this cut face is zero;
            axial bending stresses vanish at this cross section.
          </>
        )}
      </div>
    </aside>
  )
}
