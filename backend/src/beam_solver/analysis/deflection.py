"""Exact Euler--Bernoulli slope and deflection for determinate, constant-EI beams."""

from collections.abc import Sequence

import numpy as np
from numpy.polynomial import Polynomial

from beam_solver.analysis.results import DeflectionResult, DeflectionSegment, Extreme, Segment
from beam_solver.domain import Beam, SupportKind
from beam_solver.domain.sections import PropertySpan
from beam_solver.errors import SolverConsistencyError
from beam_solver.tolerances import POSITION_TOL, same_position


def _row(count: int) -> np.ndarray:
    return np.zeros(2 * count, dtype=float)


def _segment_at(segments: Sequence[Segment], x: float) -> int:
    """Choose a segment containing x; use the right segment at an internal boundary."""
    for i, segment in enumerate(segments):
        if segment.x_start - POSITION_TOL <= x < segment.x_end - POSITION_TOL:
            return i
    if segments and same_position(x, segments[-1].x_end):
        return len(segments) - 1
    raise SolverConsistencyError(f"no analysis segment contains x = {x}")


def _particular(segment: Segment, flexural_rigidity: float) -> tuple[Polynomial, Polynomial]:
    curvature = segment.moment_poly() / flexural_rigidity
    slope = curvature.integ()
    return slope, slope.integ()


def _span_for_segment(spans: tuple[PropertySpan, ...], segment: Segment) -> PropertySpan:
    """Find the property span containing this analysis segment."""
    mid = (segment.x_start + segment.x_end) / 2.0
    for span in spans:
        if span.x_start - POSITION_TOL <= mid <= span.x_end + POSITION_TOL:
            return span
    raise SolverConsistencyError(
        f"no property span covers segment [{segment.x_start}, {segment.x_end}]"
    )


def solve_deflection(beam: Beam, segments: Sequence[Segment]) -> DeflectionResult:
    """Integrate ``EI y'' = M`` and solve all continuity/support conditions at once."""
    if not segments:
        raise SolverConsistencyError("physical deflection requires analysis segments")

    spans = beam.resolved_spans
    if spans is None:
        raise SolverConsistencyError("physical deflection requires material and section")
    particulars = tuple(
        _particular(segment, _span_for_segment(spans, segment).ei)
        for segment in segments
    )
    rows: list[np.ndarray] = []
    rhs: list[float] = []
    count = len(segments)

    # Adjacent polynomial pieces share displacement. Rotation also shares unless a hinge
    # releases it.
    for i in range(count - 1):
        left = segments[i]
        x = left.x_end
        h = left.length
        slope_left, deflection_left = particulars[i]
        slope_right, deflection_right = particulars[i + 1]

        displacement = _row(count)
        displacement[2 * i] = h
        displacement[2 * i + 1] = 1.0
        displacement[2 * (i + 1) + 1] = -1.0
        rows.append(displacement)
        rhs.append(float(deflection_right(0.0) - deflection_left(h)))

        if not any(same_position(x, hinge) for hinge in beam.hinges):
            rotation_row = _row(count)
            rotation_row[2 * i] = 1.0
            rotation_row[2 * (i + 1)] = -1.0
            rows.append(rotation_row)
            rhs.append(float(slope_right(0.0) - slope_left(h)))

    # Pins and rollers impose y=0; fixed supports also impose theta=0.
    for support in beam.supports:
        i = _segment_at(segments, support.position)
        segment = segments[i]
        t = support.position - segment.x_start
        slope_particular, displacement_particular = particulars[i]

        vertical = _row(count)
        vertical[2 * i] = t
        vertical[2 * i + 1] = 1.0
        rows.append(vertical)
        rhs.append(-float(displacement_particular(t)))

        if support.kind is SupportKind.FIXED:
            rotation_row = _row(count)
            rotation_row[2 * i] = 1.0
            rows.append(rotation_row)
            rhs.append(-float(slope_particular(t)))

    matrix = np.vstack(rows)
    vector = np.asarray(rhs, dtype=float)
    expected = 2 * count
    if matrix.shape != (expected, expected):
        raise SolverConsistencyError(
            "deflection boundary conditions do not match the integration constants: "
            f"got {matrix.shape[0]} equations for {expected} constants"
        )
    try:
        constants = np.linalg.solve(matrix, vector)
    except np.linalg.LinAlgError as exc:
        raise SolverConsistencyError("deflection boundary conditions are singular") from exc

    solved: list[DeflectionSegment] = []
    candidates: list[Extreme] = []
    for i, segment in enumerate(segments):
        slope_particular, displacement_particular = particulars[i]
        slope_poly = slope_particular + Polynomial([constants[2 * i]])
        displacement_poly = displacement_particular + Polynomial(
            [constants[2 * i + 1], constants[2 * i]]
        )
        solved.append(
            DeflectionSegment(
                segment.x_start,
                segment.x_end,
                tuple(float(c) for c in slope_poly.coef),
                tuple(float(c) for c in displacement_poly.coef),
            )
        )
        ts = [0.0, segment.length]
        for root_value in slope_poly.roots():
            root = complex(root_value)
            if abs(root.imag) <= 1e-9 and POSITION_TOL < root.real < segment.length - POSITION_TOL:
                ts.append(float(root.real))
        candidates.extend(Extreme(segment.x_start + t, float(displacement_poly(t))) for t in ts)

    upward = max(candidates, key=lambda e: e.value)
    downward = min(candidates, key=lambda e: e.value)
    absolute = max(candidates, key=lambda e: abs(e.value))
    scale = max(1.0, abs(absolute.value))
    zero_tol = 1e-12 * scale
    return DeflectionResult(
        tuple(solved),
        upward if upward.value > zero_tol else None,
        downward if downward.value < -zero_tol else None,
        absolute,
    )
