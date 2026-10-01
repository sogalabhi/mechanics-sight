"""Invariants on random determinate beams (plan.md Section 8.3)."""

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from beam_solver.analysis import AnalysisResult, Side, analyze
from beam_solver.domain import (
    Beam,
    DistributedLoad,
    Load,
    PointLoad,
    PointMoment,
    Support,
    SupportKind,
)

L = 10.0
positions = st.floats(0.0, L).map(lambda x: round(x, 3))
magnitudes = st.floats(-50.0, 50.0)


@st.composite
def distributed(draw: st.DrawFn, i: int) -> DistributedLoad:
    a = draw(st.floats(0.0, L - 0.1).map(lambda x: round(x, 3)))
    b = draw(st.floats(a + 0.05, L).map(lambda x: round(x, 3)))
    b = min(max(b, a + 0.05), L)
    w1, w2 = draw(st.floats(0, 20)), draw(st.floats(0, 20))
    sign = draw(st.sampled_from([-1.0, 1.0]))
    return DistributedLoad(f"d{i}", a, b, sign * w1, sign * w2)


@st.composite
def beams(draw: st.DrawFn) -> Beam:
    kind = draw(st.sampled_from(["simple", "overhang", "cantilever_left", "cantilever_right"]))
    if kind == "simple":
        supports = (Support("a", SupportKind.PIN, 0.0), Support("b", SupportKind.ROLLER, L))
    elif kind == "overhang":
        x1 = draw(st.floats(0.0, 4.0).map(lambda x: round(x, 2)))
        x2 = draw(st.floats(6.0, L).map(lambda x: round(x, 2)))
        supports = (Support("a", SupportKind.ROLLER, x1), Support("b", SupportKind.PIN, x2))
    elif kind == "cantilever_left":
        supports = (Support("a", SupportKind.FIXED, 0.0),)
    else:
        supports = (Support("a", SupportKind.FIXED, L),)
    n = draw(st.integers(0, 5))
    loads: list[Load] = []
    for i in range(n):
        choice = draw(st.sampled_from(["point", "moment", "distributed"]))
        if choice == "point":
            loads.append(PointLoad(f"p{i}", draw(positions), draw(magnitudes), fx=draw(magnitudes)))
        elif choice == "moment":
            loads.append(PointMoment(f"c{i}", draw(positions), draw(magnitudes)))
        else:
            loads.append(draw(distributed(i)))
    return Beam(L, supports, tuple(loads))


def all_loads(beam: Beam, result: AnalysisResult) -> tuple[Load, ...]:
    from beam_solver.analysis.analyze import reaction_loads

    return beam.loads + reaction_loads(result.reactions, beam)


def from_right(loads: tuple[Load, ...], x: float) -> tuple[float, float]:
    """Independent route: split + resultant + moment_about, right-side rule."""
    v = m = 0.0
    for load in loads:
        _, right = load.split(x)
        if right is not None:
            v -= right.resultant()
            m += right.moment_about(x)
    return v, m


def interior_samples(result: AnalysisResult) -> list[float]:
    xs = []
    for s in result.segments:
        if s.length > 1e-3:
            xs += list(s.x_start + s.length * np.array([0.13, 0.5, 0.87]))
    return xs


@settings(max_examples=200, deadline=None)
@given(beams())
def test_left_equals_right(beam: Beam) -> None:
    result = analyze(beam)
    loads = all_loads(beam, result)
    for x in interior_samples(result):
        v, m = from_right(loads, x)
        assert result.shear_at(x, side=Side.LEFT) == pytest.approx(v, abs=1e-6)
        assert result.moment_at(x, side=Side.LEFT) == pytest.approx(m, abs=1e-5)


@settings(max_examples=200, deadline=None)
@given(beams())
def test_calculus_and_degrees(beam: Beam) -> None:
    result = analyze(beam)
    for s in result.segments:
        v, m = s.shear_poly(), s.moment_poly()
        assert v.degree() <= 2
        assert m.degree() <= 3
        t = np.linspace(0.0, s.length, 7)
        assert np.allclose(m.deriv()(t), v(t), atol=1e-6)


@settings(max_examples=200, deadline=None)
@given(beams())
def test_closure_and_jumps(beam: Beam) -> None:
    result = analyze(beam)
    loads = all_loads(beam, result)
    last = result.critical_points[-1]
    assert (last.shear_right, last.moment_right) == (0.0, 0.0)
    for cp in result.critical_points:
        at = [ld for ld in loads if any(abs(b - cp.x) < 1e-6 for b in ld.breakpoints())]
        forces = sum(ld.resultant() for ld in at if isinstance(ld, PointLoad))
        couples = sum(ld.magnitude for ld in at if isinstance(ld, PointMoment))
        assert cp.shear_right - cp.shear_left == pytest.approx(forces, abs=1e-6)
        assert cp.moment_right - cp.moment_left == pytest.approx(-couples, abs=1e-5)


@settings(max_examples=200, deadline=None)
@given(beams())
def test_extremes_bound_samples(beam: Beam) -> None:
    result = analyze(beam)
    sampled = result.sample(50)
    top = result.max_sagging.value if result.max_sagging else 0.0
    bottom = result.max_hogging.value if result.max_hogging else 0.0
    # Allow floating-point roundoff at the existing moment tolerance boundary.
    roundoff = 1e-12 * max(1.0, *(abs(m) for m in sampled.moment))
    assert max(sampled.moment) <= top + 1e-5 + roundoff
    assert min(sampled.moment) >= bottom - 1e-5 - roundoff


@settings(max_examples=150, deadline=None)
@given(beams())
def test_axial_right_section_and_jumps(beam: Beam) -> None:
    """Independent right-section equilibrium, point-force jumps and closure for N."""
    result = analyze(beam)
    loads = all_loads(beam, result)
    for x in interior_samples(result):
        right_force = sum(
            right.horizontal_resultant()
            for load in loads
            if (right := load.split(x)[1]) is not None
        )
        assert result.axial_at(x, side=Side.RIGHT) == pytest.approx(right_force, abs=1e-7)
    for cp in result.critical_points:
        applied = sum(
            load.horizontal_resultant()
            for load in loads
            if isinstance(load, PointLoad) and abs(load.position - cp.x) < 1e-6
        )
        assert cp.axial_right - cp.axial_left == pytest.approx(-applied, abs=1e-7)
    assert result.critical_points[-1].axial_right == 0.0
    assert all(len(seg.axial) == 1 for seg in result.segments)
