"""Critical positions and segment polynomials (plan.md Sections 7.1-7.2)."""

from collections.abc import Iterable, Sequence
from itertools import pairwise

from numpy.polynomial import Polynomial

from beam_solver.analysis.results import Segment
from beam_solver.domain import Beam, Load
from beam_solver.tolerances import POSITION_TOL


def critical_positions(beam: Beam, loads: Iterable[Load]) -> tuple[float, ...]:
    """Sorted positions of 0, L, supports and load breakpoints, merged within tolerance."""
    raw = [0.0, beam.length, *(s.position for s in beam.supports)]
    raw.extend(x for load in loads for x in load.breakpoints())
    merged: list[float] = []
    for x in sorted(min(max(x, 0.0), beam.length) for x in raw):
        if not merged or x - merged[-1] > POSITION_TOL:
            merged.append(x)
    if merged[-1] != beam.length:  # keep L exact after merging
        merged[-1] = beam.length
    return tuple(merged)


def build_segments(
    positions: Sequence[float], loads: Sequence[Load], force_tol: float, moment_tol: float
) -> tuple[Segment, ...]:
    """Sum every load's section polynomials on each segment."""
    segments = []
    for x_start, x_end in pairwise(positions):
        shear = Polynomial([0.0])
        moment = Polynomial([0.0])
        for load in loads:
            v, m = load.section_polynomials(x_start)
            shear = shear + v
            moment = moment + m
        segments.append(
            Segment(
                x_start,
                x_end,
                tuple(float(c) for c in shear.trim(force_tol).coef),
                tuple(float(c) for c in moment.trim(moment_tol).coef),
            )
        )
    return tuple(segments)
