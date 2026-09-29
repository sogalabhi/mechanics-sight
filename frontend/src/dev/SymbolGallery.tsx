import type { ReactNode } from 'react'
import {
  Beam, Couple, DimensionChain, DistributedLoad, FixedSupport, PinSupport, PointLoad,
  ReactionForce, ReactionMoment, RollerSupport, type SymbolState,
} from '@/drawing'
import styles from './SymbolGallery.module.css'

const STATES: SymbolState[] = ['default', 'hover', 'selected', 'ghost', 'invalid']

function Cell({ label, children, w = 140, h = 130 }: { label: string; children: ReactNode; w?: number; h?: number }) {
  return (
    <figure className={styles.cell}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {children}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function Row({ title, render }: { title: string; render: (s: SymbolState) => ReactNode }) {
  return (
    <section>
      <h2 className={styles.h}>{title}</h2>
      <div className={styles.row}>
        {STATES.map((s) => (
          <Cell key={s} label={s}>
            <g transform="translate(70,50)">
              <Beam length={0} />
              {render(s)}
            </g>
          </Cell>
        ))}
      </div>
    </section>
  )
}

export default function SymbolGallery() {
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Symbol gallery</h1>

      <Row title="Pin support" render={(s) => <PinSupport x={0} state={s} />} />
      <Row title="Roller support" render={(s) => <RollerSupport x={0} state={s} />} />
      <section>
        <h2 className={styles.h}>Fixed support (left / right)</h2>
        <div className={styles.row}>
          {STATES.map((s) => (
            <Cell key={s} label={s} w={200}>
              <g transform="translate(40,60)">
                <Beam length={120} />
                <FixedSupport x={0} end="left" state={s} />
                <FixedSupport x={120} end="right" state={s} />
              </g>
            </Cell>
          ))}
        </div>
      </section>
      <Row title="Point load (down)" render={(s) => <g transform="translate(0,55)"><PointLoad x={0} magnitude={-10} state={s} /></g>} />
      <Row title="Point load (up)" render={(s) => <g transform="translate(0,55)"><PointLoad x={0} magnitude={10} state={s} /></g>} />
      <Row title="Couple (anticlockwise)" render={(s) => <g transform="translate(0,20)"><Couple x={0} magnitude={12} state={s} /></g>} />
      <Row title="Couple (clockwise)" render={(s) => <g transform="translate(0,20)"><Couple x={0} magnitude={-12} state={s} /></g>} />

      <section>
        <h2 className={styles.h}>Distributed loads (UDL, UVL, trapezoidal, upward)</h2>
        <div className={styles.row}>
          {(
            [
              ['UDL', -5, -5],
              ['UVL', 0, -5],
              ['Trapezoidal', -2, -5],
              ['Upward UDL', 3, 3],
            ] as const
          ).map(([name, a, b]) => (
            <Cell key={name} label={name} w={200} h={130}>
              <g transform="translate(20,90)">
                <Beam length={160} />
                <DistributedLoad xs={20} xe={140} w1={a} w2={b} wMax={5} state="default" />
              </g>
            </Cell>
          ))}
          <Cell label="selected (handles)" w={200}>
            <g transform="translate(20,90)">
              <Beam length={160} />
              <DistributedLoad xs={20} xe={140} w1={-2} w2={-5} wMax={5} state="selected" />
            </g>
          </Cell>
        </div>
      </section>

      <section>
        <h2 className={styles.h}>Reactions</h2>
        <div className={styles.row}>
          <Cell label="up" w={200}>
            <g transform="translate(100,20)">
              <Beam length={0} />
              <PinSupport x={0} />
              <ReactionForce x={0} value={5} />
            </g>
          </Cell>
          <Cell label="down" w={200}>
            <g transform="translate(100,20)">
              <Beam length={0} />
              <RollerSupport x={0} />
              <ReactionForce x={0} value={-5} />
            </g>
          </Cell>
          <Cell label="moment" w={240}>
            <g transform="translate(40,60)">
              <Beam length={160} />
              <FixedSupport x={0} end="left" />
              <ReactionMoment x={0} end="left" value={-30} />
            </g>
          </Cell>
        </div>
      </section>

      <section>
        <h2 className={styles.h}>Composed beam</h2>
        <Cell label="pin – roller, point load, UDL, dimensions" w={520} h={240}>
          <g transform="translate(48,120)">
            <Beam length={420} showHandle />
            <PinSupport x={0} />
            <RollerSupport x={420} />
            <PointLoad x={140} magnitude={-10} />
            <DistributedLoad xs={210} xe={360} w1={-2} w2={-2} wMax={2} />
            <ReactionForce x={0} value={5} />
            <ReactionForce x={420} value={5} />
            <DimensionChain
              showHandle
              points={[
                { x: 0, value: 0 },
                { x: 140, value: 2 },
                { x: 420, value: 6 },
              ]}
            />
          </g>
        </Cell>
      </section>
    </div>
  )
}
