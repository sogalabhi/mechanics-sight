import { formatNumber } from '@/math/format'
import { isJump, valueAt } from '@/math/poly'
import { useStore } from '@/store/store'
import { SignConvention } from './SignConvention'

const f = (p: { left: number; right: number }) =>
  isJump(p)
    ? `${formatNumber(p.left, { sign: true })} / ${formatNumber(p.right, { sign: true })}`
    : formatNumber(p.right, { sign: true })

export function StatusBar() {
  const x = useStore((s) => s.pinnedX ?? s.hoverX)
  const result = useStore((s) => s.result)
  return (
    <>
      {x === null || !result ? (
        'x = —'
      ) : (
        <>
          x = {formatNumber(x)} m &nbsp;&nbsp; V = {f(valueAt(result, x, 'shear'))} kN &nbsp;&nbsp; M ={' '}
          {f(valueAt(result, x, 'moment'))} kN·m
        </>
      )}
      <SignConvention />
    </>
  )
}
