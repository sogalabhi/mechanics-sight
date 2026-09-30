import { BeamView, BEAM_PANEL_HEIGHT } from '@/canvas/BeamView'
import { Guides } from '@/canvas/Guides'
import { XScaleProvider } from '@/canvas/XScaleContext'
import { DIAGRAM_HEIGHT, DiagramPanel } from '@/diagrams/DiagramPanel'
import { DEFLECTION_PANEL_HEIGHT, ElasticCurvePanel } from '@/diagrams/ElasticCurvePanel'
import { useStore } from '@/store/store'

export const REPORT_WIDTH = 900

const NS = 'http://www.w3.org/2000/svg'

/** Report drawings at a fixed width, rendered off-screen and serialized into the report. */
export function ReportFigures() {
  const length = useStore((s) => s.beam.length)
  const w = REPORT_WIDTH
  return (
    <XScaleProvider length={length} width={w}>
      <svg data-fig="beam" xmlns={NS} width={w} height={BEAM_PANEL_HEIGHT} viewBox={`0 0 ${w} ${BEAM_PANEL_HEIGHT}`}>
        <Guides height={BEAM_PANEL_HEIGHT} />
        <BeamView />
      </svg>
      <svg data-fig="afd" xmlns={NS} width={w} height={DIAGRAM_HEIGHT} viewBox={`0 0 ${w} ${DIAGRAM_HEIGHT}`}>
        <DiagramPanel kind="axial" width={w} />
      </svg>
      <svg data-fig="sfd" xmlns={NS} width={w} height={DIAGRAM_HEIGHT} viewBox={`0 0 ${w} ${DIAGRAM_HEIGHT}`}>
        <DiagramPanel kind="shear" width={w} />
      </svg>
      <svg data-fig="bmd" xmlns={NS} width={w} height={DIAGRAM_HEIGHT} viewBox={`0 0 ${w} ${DIAGRAM_HEIGHT}`}>
        <DiagramPanel kind="moment" width={w} />
      </svg>
      <svg data-fig="deflection" xmlns={NS} width={w} height={DEFLECTION_PANEL_HEIGHT} viewBox={`0 0 ${w} ${DEFLECTION_PANEL_HEIGHT}`}>
        <ElasticCurvePanel width={w} />
      </svg>
    </XScaleProvider>
  )
}
