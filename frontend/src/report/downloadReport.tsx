import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { analyze } from '@/api/client'
import { useStore } from '@/store/store'
import { buildReportHtml } from './reportHtml'
import { ReportFigures } from './ReportFigures'

/** Draw the three figures off-screen with selection, crosshair and reactions cleared. */
function renderFigures(): { beam: string; afd: string; sfd: string; bmd: string; deflection: string } {
  const s = useStore.getState()
  const saved = { selectedId: s.selectedId, hoverX: s.hoverX, pinnedX: s.pinnedX, sawCutX: s.sawCutX, integrationRange: s.integrationRange, showReactions: s.showReactions, showGuides: s.showGuides, showCalculus: s.showCalculus, showDeflection: s.showDeflection }
  useStore.setState({ selectedId: null, hoverX: null, pinnedX: null, sawCutX: null, integrationRange: null, showReactions: false, showGuides: true, showCalculus: false, showDeflection: s.showDeflection })
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<ReportFigures />))
    const get = (k: string) => host.querySelector(`svg[data-fig="${k}"]`)?.outerHTML ?? ''
    return {
      beam: get('beam'),
      afd: get('afd'),
      sfd: get('sfd'),
      bmd: get('bmd'),
      deflection: useStore.getState().result?.deflection ? get('deflection') : '',
    }
  } finally {
    root.unmount()
    useStore.setState(saved)
  }
}

/** Fetch fresh working steps for the current beam and download a self-contained HTML report. */
export async function downloadReport(): Promise<void> {
  const { beam, result, selectedMethod } = useStore.getState()
  if (!result) throw new Error('Nothing to report yet: add a support first.')
  const withSteps = await analyze(beam, undefined, true, selectedMethod)
  if (!withSteps.steps) throw new Error('The solver did not return steps. Restart the backend.')
  const html = buildReportHtml({
    beam,
    result: withSteps,
    steps: withSteps.steps,
    figures: renderFigures(),
    date: new Date().toISOString().slice(0, 10),
  })
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `beam-report-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}
