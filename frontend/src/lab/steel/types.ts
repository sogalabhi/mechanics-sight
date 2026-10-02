import type { components } from '@/api/schema'

type S = components['schemas']

export type TensionIn = S['TensionIn']
export type TensionOut = S['TensionOut']
export type LabOp = NonNullable<TensionIn['history']>[number]
export type TensionState = TensionOut['state']
export type TracePoint = TensionOut['trace'][number]
export type Landmark = TensionOut['landmarks'][number]
export type Region = TensionState['region']

/** What the views draw: the backend state, or a replayed point of its trace while playing. */
export type DisplayState = TensionState

export const PRESET = 'steel_textbook'
export const SPECIMEN = { diameter_mm: 10, gauge_length_mm: 50 } as const
