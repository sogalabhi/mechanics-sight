export interface LaneItem {
  id: string
  start: number
  end: number
  /** Profile height in px. */
  height: number
}

const GAP = 14

/** Pack overlapping loads into lanes; returns each load's lift (px) above the beam. */
export function packLanes(items: LaneItem[]): Map<string, number> {
  const lanes: { end: number; height: number; ids: string[] }[] = []
  const laneOf = new Map<string, number>()
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    let k = lanes.findIndex((l) => it.start >= l.end - 1e-9)
    if (k < 0) {
      lanes.push({ end: it.end, height: it.height, ids: [it.id] })
      k = lanes.length - 1
    } else {
      lanes[k].end = it.end
      lanes[k].height = Math.max(lanes[k].height, it.height)
      lanes[k].ids.push(it.id)
    }
    laneOf.set(it.id, k)
  }
  const liftOfLane: number[] = []
  let acc = 0
  for (const l of lanes) {
    liftOfLane.push(acc)
    acc += l.height + GAP
  }
  return new Map([...laneOf].map(([id, k]) => [id, liftOfLane[k]]))
}
