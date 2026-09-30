import { formatNumber } from '@/math/format'
import { isJump, valueAt } from '@/math/poly'
import { useStore } from '@/store/store'

export function StatusBar() {
  const x = useStore((s) => s.pinnedX ?? s.hoverX)
  const result = useStore((s) => s.result)
  if (x === null || !result) return <>x = —</>
  const v = valueAt(result, x, 'shear')
  const m = valueAt(result, x, 'moment')
  const f = (p: { left: number; right: number }) =>
    isJump(p) ? `${formatNumber(p.left, { sign: true })} / ${formatNumber(p.right, { sign: true })}` : formatNumber(p.right, { sign: true })
  return (
    <>
      x = {formatNumber(x)} m &nbsp;&nbsp; V = {f(v)} kN &nbsp;&nbsp; M = {f(m)} kN·m
    </>
  )
}
