import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { analyze } from '@/api/client'
import { useStore } from '@/store/store'
import { buildReportHtml } from './reportHtml'
import { ReportFigures } from './ReportFigures'

/** Draw the three figures off-screen with selection, crosshair and reactions cleared. */
function renderFigures(): { beam: string; sfd: string; bmd: string } {
  const s = useStore.getState()
  const saved = { selectedId: s.selectedId, hoverX: s.hoverX, pinnedX: s.pinnedX, integrationRange: s.integrationRange, showReactions: s.showReactions, showGuides: s.showGuides, showCalculus: s.showCalculus }
  useStore.setState({ selectedId: null, hoverX: null, pinnedX: null, integrationRange: null, showReactions: false, showGuides: true, showCalculus: false })
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<ReportFigures />))
    const get = (k: string) => host.querySelector(`svg[data-fig="${k}"]`)?.outerHTML ?? ''
    return { beam: get('beam'), sfd: get('sfd'), bmd: get('bmd') }
  } finally {
    root.unmount()
    useStore.setState(saved)
  }
}

/** Fetch fresh working steps for the current beam and download a self-contained HTML report. */
export async function downloadReport(): Promise<void> {
  const { beam, result } = useStore.getState()
  if (!result) throw new Error('Nothing to report yet: add a support first.')
  const withSteps = await analyze(beam, undefined, true)
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
