"""Stability and determinacy from support restraints (plan.md Sections 6.2-6.3)."""

from dataclasses import dataclass
from enum import Enum

import numpy as np

from beam_solver.solvers.equilibrium import AXIAL_ROWS, BENDING_ROWS, EquilibriumSystem


class Determinacy(Enum):
    UNSTABLE = "unstable"
    DETERMINATE = "determinate"
    INDETERMINATE = "indeterminate"


@dataclass(frozen=True)
class Classification:
    """Result of classifying a beam. Degrees are meaningful only when stable."""

    status: Determinacy
    restraints: int
    equations: int
    axial_degree: int
    bending_degree: int
    reason: str | None = None

    @property
    def degree(self) -> int:
        return self.axial_degree + self.bending_degree


def classify(system: EquilibriumSystem) -> Classification:
    """Count restraints against equations, then check the rank of each block."""
    r = len(system.unknowns)
    e = system.equations
    r_axial = len(system.axial_columns())
    r_bending = len(system.bending_columns())
    e_axial = len(AXIAL_ROWS)
    e_bending = len(BENDING_ROWS)

    def unstable(reason: str) -> Classification:
        return Classification(Determinacy.UNSTABLE, r, e, 0, 0, reason)

    if r_axial < e_axial:
        return unstable("Nothing resists horizontal movement: add a pin or fixed support.")
    if r_bending < e_bending:
        return unstable(
            "Too few vertical or rotational restraints "
            f"(have {r_bending}, need at least {e_bending})."
        )
    a_bending, _ = system.bending_block()
    if np.linalg.matrix_rank(a_bending) < e_bending:
        return unstable("The supports are arranged so that part of the beam can move freely.")

    axial_degree = r_axial - e_axial
    bending_degree = r_bending - e_bending
    status = (
        Determinacy.DETERMINATE if axial_degree + bending_degree == 0 else Determinacy.INDETERMINATE
    )
    return Classification(status, r, e, axial_degree, bending_degree)
