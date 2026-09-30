"""Extremes and zero-shear points, found exactly from the polynomials (plan.md 7.4)."""

from collections.abc import Sequence
from dataclasses import dataclass

from numpy.polynomial import Polynomial

from beam_solver.analysis.results import CriticalPoint, Extreme, Segment

_ROOT_IMAG_TOL = 1e-9


@dataclass(frozen=True)
class Extremes:
    max_sagging: Extreme | None
    max_hogging: Extreme | None
    max_positive_shear: Extreme | None
    max_negative_shear: Extreme | None
    zero_shear_points: tuple[float, ...]
    max_tension: Extreme | None = None
    max_compression: Extreme | None = None


def interior_roots(poly: Polynomial, length: float) -> list[float]:
    """Real roots strictly inside (0, length), in local t."""
    if poly.degree() < 1:
        return []
    edge = 1e-12 * max(length, 1.0)
    roots: list[complex] = [complex(r) for r in poly.roots()]
    return sorted(
        r.real
        for r in roots
        if abs(r.imag) <= _ROOT_IMAG_TOL * max(1.0, abs(r.real)) and edge < r.real < length - edge
    )


def _pick(candidates: Sequence[tuple[float, float]], tol: float, largest: bool) -> Extreme | None:
    """Largest (or most negative) value beyond tol; ties go to the leftmost x."""
    sign = 1.0 if largest else -1.0
    best = max((sign * v for _, v in candidates), default=0.0)
    if best <= tol:
        return None
    x = min(x for x, v in candidates if sign * v >= best - tol)
    return Extreme(x, sign * best)


def find_extremes(
    segments: Sequence[Segment],
    points: Sequence[CriticalPoint],
    force_tol: float,
    moment_tol: float,
) -> Extremes:
    moments: list[tuple[float, float]] = []
    shears: list[tuple[float, float]] = []
    axials: list[tuple[float, float]] = []
    zero_shear: list[float] = []
    for i, p in enumerate(points):
        moments += [(p.x, p.moment_left), (p.x, p.moment_right)]
        # Left of x = 0 and right of x = L lie outside the beam, so skip those values.
        if i > 0:
            shears.append((p.x, p.shear_left))
            axials.append((p.x, p.axial_left))
        if i < len(points) - 1:
            shears.append((p.x, p.shear_right))
            axials.append((p.x, p.axial_right))
        if p.shear_left * p.shear_right < 0:
            zero_shear.append(p.x)
    for segment in segments:
        v, m = segment.shear_poly(), segment.moment_poly()
        for t in interior_roots(v, segment.length):
            x = segment.x_start + t
            zero_shear.append(x)
            moments.append((x, float(m(t))))
        for t in interior_roots(v.deriv(), segment.length):
            shears.append((segment.x_start + t, float(v(t))))
    return Extremes(
        _pick(moments, moment_tol, largest=True),
        _pick(moments, moment_tol, largest=False),
        _pick(shears, force_tol, largest=True),
        _pick(shears, force_tol, largest=False),
        tuple(sorted(zero_shear)),
        _pick(axials, force_tol, largest=True),
        _pick(axials, force_tol, largest=False),
    )
