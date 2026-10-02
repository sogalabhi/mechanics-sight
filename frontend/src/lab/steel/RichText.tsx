import { Math as Tex } from '@/working/Math'
import { splitRich } from './rich'

/** Text with inline LaTeX between dollar signs: "stress $\sigma = E\varepsilon$ rises". */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitRich(text).map((p, i) =>
        p.kind === 'tex' ? <Tex key={i} tex={p.value} /> : p.kind === 'bold' ? <b key={i}>{p.value}</b> : p.kind === 'italic' ? <i key={i}>{p.value}</i> : <span key={i}>{p.value}</span>,
      )}
    </>
  )
}
