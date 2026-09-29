"""The equilibrium system A·r = b built from support restraints (plan.md Section 6.1)."""

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from beam_solver.domain import Beam, Direction, PointLoad, PointMoment

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
    """A·r = b with rows (ΣFx, ΣFy, ΣM about 0) and one column per unknown."""

    unknowns: tuple[Unknown, ...]
    a: FloatArray
    b: FloatArray

    @classmethod
    def from_beam(cls, beam: Beam) -> "EquilibriumSystem":
        unknowns = tuple(Unknown(s.id, s.position, d) for s in beam.supports for d in s.restraints)
        a = np.array([unit_column(u) for u in unknowns], dtype=np.float64).T
        b = -np.array(
            [
                0.0,  # no applied horizontal loads in Phase 1
                sum(load.resultant() for load in beam.loads),
                sum(load.moment_about(0.0) for load in beam.loads),
            ],
            dtype=np.float64,
        )
        return cls(unknowns, a, b)

    @property
    def equations(self) -> int:
        return int(self.a.shape[0])

    def axial_columns(self) -> list[int]:
        return [i for i, u in enumerate(self.unknowns) if u.direction is Direction.X]

    def bending_columns(self) -> list[int]:
        return [i for i, u in enumerate(self.unknowns) if u.direction is not Direction.X]

    def bending_block(self) -> tuple[FloatArray, FloatArray]:
        rows = list(BENDING_ROWS)
        return self.a[np.ix_(rows, self.bending_columns())], self.b[rows]
