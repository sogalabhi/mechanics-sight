"""Critical positions and segment polynomials (plan.md Sections 7.1-7.2)."""

from collections.abc import Iterable, Sequence
from itertools import pairwise

from numpy.polynomial import Polynomial

from beam_solver.analysis.results import Segment
from beam_solver.domain import Beam, Load
from beam_solver.tolerances import POSITION_TOL


def critical_positions(beam: Beam, loads: Iterable[Load]) -> tuple[float, ...]:
    """Sorted positions of 0, L, supports and load breakpoints, merged within tolerance."""
    raw = [0.0, beam.length, *(s.position for s in beam.supports), *beam.hinges]
    if beam.resolved_spans is not None:
        raw.extend(span.x_start for span in beam.resolved_spans)
        raw.extend(span.x_end for span in beam.resolved_spans)
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
        axial = Polynomial([0.0])
        for load in loads:
            v, m = load.section_polynomials(x_start)
            shear = shear + v
            moment = moment + m
            axial = axial + load.axial_polynomial(x_start)
        length = x_end - x_start
        shear_coef = _trimmed(shear, length, force_tol)
        moment_coef = _moment_like_shear(moment, shear_coef, moment_tol)
        axial_coef = _trimmed(axial, length, force_tol)
        segments.append(Segment(x_start, x_end, shear_coef, moment_coef, axial_coef))
    return tuple(segments)


def _trimmed(poly: Polynomial, length: float, tol: float) -> tuple[float, ...]:
    """Drop trailing terms whose largest contribution on the segment, |c|·hᵏ, is below tol."""
    coef = [float(c) for c in poly.coef]
    while len(coef) > 1 and abs(coef[-1]) * length ** (len(coef) - 1) <= tol:
        coef.pop()
    if len(coef) == 1 and abs(coef[0]) <= tol:
        coef[0] = 0.0
    return tuple(coef)


def _moment_like_shear(
    moment: Polynomial, shear: tuple[float, ...], tol: float
) -> tuple[float, ...]:
    """Trim M to match the trimmed V: since M' = V, M's term k+1 exists only if V's term k does.

    Trimming the two separately could keep a V term while dropping its M term, which
    breaks M' = V on very short segments.
    """
    raw = [float(c) for c in moment.coef] + [0.0] * (len(shear) + 1)
    coef = raw[: len(shear) + 1]
    for k, v in enumerate(shear):
        if v == 0.0:
            coef[k + 1] = 0.0
    if abs(coef[0]) <= tol:
        coef[0] = 0.0
    while len(coef) > 1 and coef[-1] == 0.0:
        coef.pop()
    return tuple(coef)
