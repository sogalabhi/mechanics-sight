"""Load classes: equilibrium quantities, split and section polynomials."""

import pytest
from hypothesis import given
from hypothesis import strategies as st

from beam_solver.domain import DistributedLoad, Load, PointLoad, PointMoment
from beam_solver.errors import InvalidLoadError

approx = pytest.approx


def test_point_load() -> None:
    p = PointLoad("p", 2.0, -10.0)
    assert p.resultant() == -10.0
    assert p.moment_about(0.0) == -20.0
    assert p.moment_about(5.0) == 30.0
    assert p.breakpoints() == (2.0,)


def test_point_moment() -> None:
    c = PointMoment("c", 2.0, 5.0)
    assert c.resultant() == 0.0
    assert c.moment_about(0.0) == c.moment_about(9.0) == 5.0


def test_udl() -> None:
    d = DistributedLoad("d", 1.0, 5.0, -2.0, -2.0)
    assert d.resultant() == approx(-8.0)
    assert d.moment_about(0.0) == approx(-8.0 * 3.0)


def test_triangle_centroid() -> None:
    d = DistributedLoad("d", 0.0, 6.0, 0.0, -3.0)
    assert d.resultant() == approx(-9.0)
    assert d.moment_about(0.0) / d.resultant() == approx(4.0)


def test_equal_and_opposite_ends_is_rejected() -> None:
    with pytest.raises(InvalidLoadError):
        DistributedLoad("d", 0.0, 1.0, 2.0, -2.0)


def test_zero_length_is_rejected() -> None:
    with pytest.raises(InvalidLoadError):
        DistributedLoad("d", 1.0, 1.0, -1.0, -1.0)


def test_split_distributed() -> None:
    d = DistributedLoad("d", 0.0, 6.0, 0.0, -3.0)
    left, right = d.split(2.0)
    assert isinstance(left, DistributedLoad)
    assert isinstance(right, DistributedLoad)
    assert left.w_end == approx(-1.0)
    assert left.resultant() + right.resultant() == approx(d.resultant())
    assert left.moment_about(1.3) + right.moment_about(1.3) == approx(d.moment_about(1.3))
    assert d.split(0.0) == (None, d)
    assert d.split(6.0) == (d, None)


def test_split_point_at_position_goes_left() -> None:
    p = PointLoad("p", 2.0, 1.0)
    assert p.split(2.0) == (p, None)
    assert p.split(1.0) == (None, p)


def test_couple_section_moment_drops_for_anticlockwise() -> None:
    _, m = PointMoment("c", 1.0, 5.0).section_polynomials(1.0)
    assert m(0.3) == approx(-5.0)


def test_point_load_section() -> None:
    v, m = PointLoad("p", 1.0, 4.0).section_polynomials(2.0)
    assert v(0.5) == approx(4.0)
    assert m(0.5) == approx(4.0 * 1.5)


def test_load_to_the_right_contributes_nothing() -> None:
    for load in (
        PointLoad("p", 3.0, 1.0),
        PointMoment("c", 3.0, 1.0),
        DistributedLoad("d", 3.0, 4.0, 1.0, 2.0),
    ):
        v, m = load.section_polynomials(2.0)
        assert v(0.5) == 0.0
        assert m(0.5) == 0.0


loads_strategy = st.one_of(
    st.builds(
        PointLoad,
        st.just("p"),
        st.floats(0, 10),
        st.floats(-100, 100),
    ),
    st.builds(PointMoment, st.just("c"), st.floats(0, 10), st.floats(-100, 100)),
    st.tuples(
        st.floats(0, 9), st.floats(0.01, 5), st.floats(0, 50), st.floats(0, 50), st.booleans()
    ).map(
        lambda t: DistributedLoad(
            "d", t[0], t[0] + t[1], -t[2] if t[4] else t[2], -t[3] if t[4] else t[3]
        )
    ),
)


def _end(load: Load) -> float:
    return max(load.breakpoints())


@given(loads_strategy, st.floats(0, 5), st.floats(0, 3))
def test_section_beyond_end_matches_equilibrium(load: Load, gap: float, t: float) -> None:
    """Plan 8.3 #5: past the load, V = resultant and M = -moment_about(x)."""
    x0 = _end(load) + gap
    v, m = load.section_polynomials(x0)
    x = x0 + t
    assert v(t) == approx(load.resultant(), abs=1e-9)
    assert m(t) == approx(-load.moment_about(x), abs=1e-6)


@given(loads_strategy, st.floats(0, 1))
def test_section_matches_split_route(load: Load, frac: float) -> None:
    """Plan 8.3 #1 at load level: section polynomials agree with split + equilibrium."""
    x0 = min(load.breakpoints())
    x = x0 + frac * (_end(load) - x0) if len(load.breakpoints()) == 2 else x0 + frac
    if any(abs(x - b) < 1e-5 for b in load.breakpoints()):
        return  # within POSITION_TOL of a breakpoint the side is decided by tolerance
    v, m = load.section_polynomials(x0)
    left, _ = load.split(x)
    expected_v = left.resultant() if left else 0.0
    expected_m = -left.moment_about(x) if left else 0.0
    assert v(x - x0) == approx(expected_v, abs=1e-6)
    assert m(x - x0) == approx(expected_m, abs=1e-5)


def test_distributed_degrees() -> None:
    v, m = DistributedLoad("d", 0.0, 6.0, 0.0, -3.0).section_polynomials(1.0)
    assert v.degree() <= 2
    assert m.degree() <= 3
    assert all(abs(c) < 1e-12 for c in (m.deriv() - v).coef)
