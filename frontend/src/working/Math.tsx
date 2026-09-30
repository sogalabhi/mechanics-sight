import katex from 'katex'
import 'katex/dist/katex.min.css'

/** Renders LaTeX from the solver. throwOnError is off so a bad string never blanks the panel. */
export function Math({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: block, output: 'html' })
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
