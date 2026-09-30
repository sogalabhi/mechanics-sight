import type { components } from '@/api/schema'

type S = components['schemas']

export type BeamInput = S['BeamIn']
export type Support = S['SupportIn']
export type PointLoad = S['PointLoadIn']
export type PointMoment = S['PointMomentIn']
export type DistributedLoad = S['DistributedLoadIn']
export type Load = PointLoad | PointMoment | DistributedLoad
export type Item = Support | Load

export const isSupport = (i: Item): i is Support => i.type === 'pin' || i.type === 'roller' || i.type === 'fixed'

export type AnalysisResult = components['schemas']['AnalysisOut']
export type Segment = components['schemas']['SegmentOut']
export type CriticalPoint = components['schemas']['CriticalPointOut']
