"""The equilibrium system A·r = b built from support restraints (plan.md Section 6.1)."""

from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

from beam_solver.domain import Beam, Direction, PointLoad, PointMoment
from beam_solver.tolerances import POSITION_TOL

FloatArray = npt.NDArray[np.float64]

ROW_FX, ROW_FY, ROW_M = 0, 1, 2
AXIAL_ROWS = (ROW_FX,)
BENDING_ROWS = (ROW_FY, ROW_M)


@dataclass(frozen=True)
class Unknown:
    """One unknown reaction component."""

    support_id: str
    position: float
    direction: Direction


def unit_column(unknown: Unknown) -> tuple[float, float, float]:
    """Column of A for a unit reaction: (ΣFx, ΣFy, ΣM about x = 0)."""
    if unknown.direction is Direction.X:
        return (1.0, 0.0, 0.0)
    if unknown.direction is Direction.Y:
        unit = PointLoad("unit", unknown.position, 1.0)
        return (0.0, unit.resultant(), unit.moment_about(0.0))
    couple = PointMoment("unit", unknown.position, 1.0)
    return (0.0, couple.resultant(), couple.moment_about(0.0))


@dataclass(frozen=True)
class EquilibriumSystem:
    """A·r = b with rows (ΣFx, ΣFy, ΣM about 0, and hinge moment releases) and one column per unknown."""

    unknowns: tuple[Unknown, ...]
    a: FloatArray
    b: FloatArray
    bending_rows: tuple[int, ...] = field(default_factory=lambda: BENDING_ROWS)
    axial_rows: tuple[int, ...] = field(default_factory=lambda: AXIAL_ROWS)

    @classmethod
    def from_beam(cls, beam: Beam) -> "EquilibriumSystem":
        unknowns = tuple(Unknown(s.id, s.position, d) for s in beam.supports for d in s.restraints)
        num_hinges = len(beam.hinges)
        num_eqs = 3 + num_hinges

        cols = []
        for u in unknowns:
            col = [0.0] * num_eqs
            if u.direction is Direction.X:
                col[0] = 1.0
            elif u.direction is Direction.Y:
                col[1] = 1.0
                col[2] = u.position
                for k, h_pos in enumerate(beam.hinges):
                    if u.position < h_pos - POSITION_TOL:
                        col[3 + k] = u.position - h_pos
            else:  # ROTATION
                col[2] = 1.0
                for k, h_pos in enumerate(beam.hinges):
                    if u.position < h_pos - POSITION_TOL:
                        col[3 + k] = 1.0
            cols.append(col)

        a = np.array(cols, dtype=np.float64).T if cols else np.empty((num_eqs, 0), dtype=np.float64)

        b_vec = [0.0] * num_eqs
        b_vec[1] = -sum(load.resultant() for load in beam.loads)
        b_vec[2] = -sum(load.moment_about(0.0) for load in beam.loads)
        for k, h_pos in enumerate(beam.hinges):
            m_hinge = 0.0
            for load in beam.loads:
                left, _ = load.split(h_pos)
                if left is not None:
                    m_hinge += left.moment_about(h_pos)
            b_vec[3 + k] = -m_hinge

        b = np.array(b_vec, dtype=np.float64)
        bending_rows = tuple(range(1, num_eqs))
        return cls(unknowns, a, b, bending_rows=bending_rows)

    @property
    def equations(self) -> int:
        return int(self.a.shape[0])

    def axial_columns(self) -> list[int]:
        return [i for i, u in enumerate(self.unknowns) if u.direction is Direction.X]

    def bending_columns(self) -> list[int]:
        return [i for i, u in enumerate(self.unknowns) if u.direction is not Direction.X]

    def bending_block(self) -> tuple[FloatArray, FloatArray]:
        rows = list(self.bending_rows)
        return self.a[np.ix_(rows, self.bending_columns())], self.b[rows]
