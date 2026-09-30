"""Reaction solver for Phase 1 (plan.md Sections 6.4-6.6)."""

from dataclasses import dataclass

import numpy as np

from beam_solver.domain import Beam, Direction
from beam_solver.errors import (
    SolverConsistencyError,
    UnstableBeamError,
)
from beam_solver.solvers.classification import Classification, Determinacy, classify
from beam_solver.solvers.equilibrium import EquilibriumSystem
from beam_solver.tolerances import force_tol, load_scale


@dataclass(frozen=True)
class Reaction:
    """Support reaction: fx, fy (kN, right/up positive), moment (kN·m, anticlockwise)."""

    support_id: str
    fx: float = 0.0
    fy: float = 0.0
    moment: float = 0.0


@dataclass(frozen=True)
class ReactionSolution:
    classification: Classification
    reactions: tuple[Reaction, ...]
    warnings: tuple[str, ...]


AXIAL_NOTE = (
    "Horizontal reactions are statically indeterminate but exactly zero: "
    "there are no horizontal loads."
)


def solve_reactions(beam: Beam) -> ReactionSolution:
    """Classify the beam, then solve for its reactions."""
    system = EquilibriumSystem.from_beam(beam)
    classification = classify(system)
    if classification.status is Determinacy.UNSTABLE:
        raise UnstableBeamError(classification.reason or "unstable", classification)

    has_settlement_or_spring = any(
        s.settlement != 0.0 or s.spring_ky is not None or s.spring_ktheta is not None
        for s in beam.supports
    )
    if classification.status is Determinacy.INDETERMINATE or has_settlement_or_spring:
        from beam_solver.solvers.stiffness import solve_stiffness

        return solve_stiffness(beam, classification)

    a_bending, b_bending = system.bending_block()
    try:
        r_bending = np.linalg.solve(a_bending, b_bending)
    except np.linalg.LinAlgError as exc:  # classify() should make this impossible
        raise SolverConsistencyError(f"bending block is singular: {exc}") from exc

    values = np.zeros(len(system.unknowns))
    values[system.bending_columns()] = r_bending

    scale = load_scale(
        sum(abs(load.resultant()) + abs(load.horizontal_resultant()) for load in beam.loads),
        sum(abs(load.moment_about(0.0)) for load in beam.loads),
        beam.length,
    )

    axial_cols = system.axial_columns()
    if len(axial_cols) == 1:
        values[axial_cols[0]] = float(system.b[0])

    residual = float(np.linalg.norm(system.a @ values - system.b))
    if residual > force_tol(scale) * beam.length * 10:
        raise SolverConsistencyError(f"equilibrium residual too large: {residual}")

    components: dict[str, dict[Direction, float]] = {s.id: {} for s in beam.supports}
    for unknown, value in zip(system.unknowns, values, strict=True):
        components[unknown.support_id][unknown.direction] = float(value)
    reactions = tuple(
        Reaction(
            sid,
            fx=0.0 if abs(c.get(Direction.X, 0.0)) < 1e-12 else float(c.get(Direction.X, 0.0)),
            fy=0.0 if abs(c.get(Direction.Y, 0.0)) < 1e-12 else float(c.get(Direction.Y, 0.0)),
            moment=0.0
            if abs(c.get(Direction.ROTATION, 0.0)) < 1e-12
            else float(c.get(Direction.ROTATION, 0.0)),
        )
        for sid, c in components.items()
    )
    warnings = (AXIAL_NOTE,) if classification.axial_degree > 0 else ()
    return ReactionSolution(classification, reactions, warnings)
