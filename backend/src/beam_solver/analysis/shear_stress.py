"""Transverse shear stress τ = V·Q/(I·b) (plan.md Phase 3.7)."""

from collections.abc import Sequence

from beam_solver.analysis.results import Extreme, Segment, ShearStressProfile, ShearStressResult
from beam_solver.domain import Beam
from beam_solver.domain.sections import Section
from beam_solver.errors import SolverConsistencyError
from beam_solver.tolerances import POSITION_TOL


def _max_tau_at_section(section: Section, abs_shear: float) -> float:
    """Maximum |τ| for a given section under shear force V.

    τ_max = |V| · Q_max / (I · b), evaluated at the neutral axis (y=0).
    """
    inertia = section.second_moment
    if inertia == 0.0 or abs_shear == 0.0:
        return 0.0
    q_na = section.first_moment_above(0.0)
    b_na = section.width_at(0.0)
    if b_na <= 0.0:
        return 0.0
    return abs_shear * q_na / (inertia * b_na)


def solve_shear_stress(
    beam: Beam, segments: Sequence[Segment]
) -> ShearStressResult:
    """Find the maximum transverse shear stress along the beam."""
    spans = getattr(beam, 'resolved_spans', None)
    if spans is None:
        if beam.material is not None and beam.section is not None:
            pass
        else:
            raise SolverConsistencyError("shear stress requires material and section")

    candidates: list[Extreme] = []

    for segment in segments:
        section = None
        if spans is not None:
            mid = (segment.x_start + segment.x_end) / 2.0
            for span in spans:
                if span.x_start - POSITION_TOL <= mid <= span.x_end + POSITION_TOL:
                    section = span.section
                    break
            if section is None:
                raise SolverConsistencyError(
                    f"no property span covers segment [{segment.x_start}, {segment.x_end}]"
                )
        else:
            section = beam.section
            
        shear_poly = segment.shear_poly()
        h = segment.length

        # Evaluate τ at segment endpoints
        for t in [0.0, h]:
            v = abs(float(shear_poly(t)))
            tau = _max_tau_at_section(section, v)
            candidates.append(Extreme(segment.x_start + t, tau))

        # Evaluate at interior extremes of |V|: roots of V'(t)
        if len(segment.shear) > 1:
            deriv = shear_poly.deriv()
            for root_val in deriv.roots():
                root = complex(root_val)
                if abs(root.imag) <= 1e-9 and POSITION_TOL < root.real < h - POSITION_TOL:
                    t = float(root.real)
                    v = abs(float(shear_poly(t)))
                    tau = _max_tau_at_section(section, v)
                    candidates.append(Extreme(segment.x_start + t, tau))

    if not candidates:
        return ShearStressResult(max_shear_stress=None)

    max_tau = max(candidates, key=lambda e: e.value)
    zero_tol = 1e-9
    return ShearStressResult(
        max_shear_stress=max_tau if max_tau.value > zero_tol else None,
    )


def shear_stress_profile(
    section: Section, shear_force: float, n_points: int = 50
) -> ShearStressProfile:
    """Through-depth τ(y) distribution at a cross-section cut.

    Returns (y_values, tau_values) for plotting.
    τ(y) = V · Q(y) / (I · b(y)), with τ = 0 where b(y) = 0.
    """
    inertia = section.second_moment
    y_bot = section.y_bottom
    y_top = section.y_top
    ys: list[float] = []
    taus: list[float] = []

    for i in range(n_points + 1):
        y = y_bot + (y_top - y_bot) * i / n_points
        ys.append(y)
        b = section.width_at(y)
        if b <= 0.0 or inertia == 0.0:
            taus.append(0.0)
        else:
            q = section.first_moment_above(y)
            taus.append(shear_force * q / (inertia * b))

    return ShearStressProfile(tuple(ys), tuple(taus))
