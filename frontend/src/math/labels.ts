export interface LabelCandidate {
  id: string
  /** Lower number is placed first. */
  priority: number
  x0: number
  x1: number
  /** Labels only collide within the same band (e.g. above / below the curve). */
  band: string
}

/** Returns the ids that may be shown; a label overlapping an already placed one is hidden. */
export function placeLabels(cands: LabelCandidate[], pad = 4): Set<string> {
  const placed: LabelCandidate[] = []
  for (const c of [...cands].sort((a, b) => a.priority - b.priority)) {
    const clash = placed.some((p) => p.band === c.band && c.x0 < p.x1 + pad && p.x0 < c.x1 + pad)
    if (!clash) placed.push(c)
  }
  return new Set(placed.map((p) => p.id))
}
