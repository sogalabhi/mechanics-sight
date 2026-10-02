import { emptyBeam } from '@/model/actions'
import { useStore } from '@/store/store'

export function resetBeam() {
  if (window.confirm('Reset to an empty 6 m beam? You can undo this.')) useStore.getState().commit(emptyBeam(6), null)
}
