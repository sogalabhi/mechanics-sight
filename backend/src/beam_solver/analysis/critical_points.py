"""Exact left/right values at critical points (plan.md Section 7.3)."""

from collections.abc import Sequence
from itertools import pairwise

from beam_solver.analysis.results import CriticalPoint, Segment
from beam_solver.domain import Load
from beam_solver.errors import SolverConsistencyError


def build_critical_points(
    segments: Sequence[Segment],
    loads: Sequence[Load],
    length: float,
    force_tol: float,
    moment_tol: float,
) -> tuple[CriticalPoint, ...]:
    """Left values come from the segment before, right values from the segment after."""
    first = segments[0]
    points = [
        CriticalPoint(
            0.0,
            0.0,
            first.shear_poly()(0.0),
            0.0,
            first.moment_poly()(0.0),
            0.0,
            first.axial_poly()(0.0),
        )
    ]
    for before, after in pairwise(segments):
        points.append(
            CriticalPoint(
                after.x_start,
                float(before.shear_poly()(before.length)),
                float(after.shear_poly()(0.0)),
                float(before.moment_poly()(before.length)),
                float(after.moment_poly()(0.0)),
                float(before.axial_poly()(before.length)),
                float(after.axial_poly()(0.0)),
            )
        )

    # Just right of L everything must be zero: this is global equilibrium.
    shear_after = sum(load.resultant() for load in loads)
    moment_after = -sum(load.moment_about(length) for load in loads)
    axial_after = sum(load.horizontal_resultant() for load in loads)
    if (
        abs(shear_after) > force_tol
        or abs(moment_after) > moment_tol
        or abs(axial_after) > force_tol
    ):
        raise SolverConsistencyError(
            f"V = {shear_after}, M = {moment_after}, N = {axial_after} just right of L; expected 0"
        )
    last = segments[-1]
    points.append(
        CriticalPoint(
            length,
            float(last.shear_poly()(last.length)),
            0.0,
            float(last.moment_poly()(last.length)),
            0.0,
            float(last.axial_poly()(last.length)),
            0.0,
        )
    )
    return tuple(_clean(p, force_tol, moment_tol) for p in points)


def _clean(p: CriticalPoint, force_tol: float, moment_tol: float) -> CriticalPoint:
    """Replace round-off noise with exact zeros."""

    def f(v: float) -> float:
        return 0.0 if abs(v) <= force_tol else float(v)

    def m(v: float) -> float:
        return 0.0 if abs(v) <= moment_tol else float(v)

    return CriticalPoint(
        p.x,
        f(p.shear_left),
        f(p.shear_right),
        m(p.moment_left),
        m(p.moment_right),
        f(p.axial_left),
        f(p.axial_right),
    )
