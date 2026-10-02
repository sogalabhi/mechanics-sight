export type Piece = { kind: 'text' | 'tex' | 'bold' | 'italic'; value: string }

/** Split text with inline LaTeX ($...$), **bold** and *italic* into pieces. */
export function splitRich(text: string): Piece[] {
  return text
    .split(/(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*)/)
    .filter((p) => p !== '')
    .map((p): Piece => {
      if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) return { kind: 'tex', value: p.slice(1, -1) }
      if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return { kind: 'bold', value: p.slice(2, -2) }
      if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) return { kind: 'italic', value: p.slice(1, -1) }
      return { kind: 'text', value: p }
    })
}
