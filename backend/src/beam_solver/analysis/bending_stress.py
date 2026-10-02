"""Bending stress σ = −M·y/I at extreme fibres (plan.md Phase 3.6)."""

from collections.abc import Sequence

from beam_solver.analysis.results import BendingStressResult, BendingStressSegment, Extreme, Segment
from beam_solver.domain import Beam
from beam_solver.errors import SolverConsistencyError
from beam_solver.tolerances import POSITION_TOL


def solve_bending_stress(beam: Beam, segments: Sequence[Segment]) -> BendingStressResult:
    """Compute σ_top(x) = −M(x)·y_top/I and σ_bottom(x) = −M(x)·y_bottom/I."""
    spans = getattr(beam, "resolved_spans", None)
    material = beam.material
    uniform_section = beam.section
    if spans is None and (material is None or uniform_section is None):
        raise SolverConsistencyError("bending stress requires material and section")

    stress_segments: list[BendingStressSegment] = []
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
            if uniform_section is None:  # unreachable: checked before the loop
                raise SolverConsistencyError("bending stress requires material and section")
            section = uniform_section

        inertia = section.second_moment
        y_top = section.y_top
        y_bottom = section.y_bottom

        moment_poly = segment.moment_poly()
        # σ = −M·y / I
        # For top fibre: σ_top = −M · y_top / I
        # For bottom fibre: σ_bottom = −M · y_bottom / I
        # Since y_bottom < 0, this gives tension at bottom under sagging (M > 0)
        factor_top = -y_top / inertia if inertia != 0.0 else 0.0
        factor_bottom = -y_bottom / inertia if inertia != 0.0 else 0.0

        sigma_top_poly = moment_poly * factor_top
        sigma_bottom_poly = moment_poly * factor_bottom

        sigma_top_coef = tuple(float(c) for c in sigma_top_poly.coef)
        sigma_bottom_coef = tuple(float(c) for c in sigma_bottom_poly.coef)

        stress_segments.append(
            BendingStressSegment(
                segment.x_start,
                segment.x_end,
                sigma_top_coef,
                sigma_bottom_coef,
            )
        )

        # Evaluate extremes at segment endpoints and interior stationary points
        h = segment.length
        for t in [0.0, h]:
            x = segment.x_start + t
            for poly in (sigma_top_poly, sigma_bottom_poly):
                val = float(poly(t))
                candidates.append(Extreme(x, val))

        # Interior extremes: derivative of σ = 0 ⟹ derivative of M = 0 ⟹ V = 0
        shear_poly = segment.shear_poly()
        for root_val in shear_poly.roots():
            root = complex(root_val)
            if abs(root.imag) <= 1e-9 and POSITION_TOL < root.real < h - POSITION_TOL:
                t = float(root.real)
                x = segment.x_start + t
                candidates.append(Extreme(x, float(sigma_top_poly(t))))
                candidates.append(Extreme(x, float(sigma_bottom_poly(t))))

    # Find overall extremes
    if not candidates:
        return BendingStressResult(
            tuple(stress_segments),
            None,
            None,
            0.0,
            False,
            None,
        )

    max_tension_cand = max(candidates, key=lambda e: e.value)
    max_compression_cand = min(candidates, key=lambda e: e.value)
    max_abs_cand = max(candidates, key=lambda e: abs(e.value))

    zero_tol = 1e-9
    max_tension_result = max_tension_cand if max_tension_cand.value > zero_tol else None
    max_compression_result = (
        max_compression_cand if max_compression_cand.value < -zero_tol else None
    )

    # Yield check
    max_abs_stress = abs(max_abs_cand.value)

    # Get yield strength from the span at the location of max stress
    yield_s = 0.0
    if spans is not None:
        for span in spans:
            if span.x_start - POSITION_TOL <= max_abs_cand.x <= span.x_end + POSITION_TOL:
                yield_s = span.material.yield_strength_kn_m2
                break
    elif material is not None:
        yield_s = material.yield_strength_kn_m2

    yield_ratio = max_abs_stress / yield_s if yield_s > 0 else 0.0

    return BendingStressResult(
        segments=tuple(stress_segments),
        max_tension=max_tension_result,
        max_compression=max_compression_result,
        yield_ratio=yield_ratio,
        yield_exceeded=yield_ratio > 1.0,
        yield_location=max_abs_cand if max_abs_stress > zero_tol else None,
    )
