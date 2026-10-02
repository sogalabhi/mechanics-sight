"""Closed-form checks for the constant-EI Euler--Bernoulli solver."""

import pytest

from beam_solver.analysis import analyze
from beam_solver.domain import (
    Beam,
    DistributedLoad,
    Material,
    PointLoad,
    RectangularSection,
    Support,
    SupportKind,
)

E = 200.0
SECTION = RectangularSection(0.2, 0.3)
MATERIAL = Material(E, 250.0)
EI = MATERIAL.young_modulus_kn_m2 * SECTION.second_moment


def simply_supported(loads: tuple[PointLoad | DistributedLoad, ...], length: float = 6.0) -> Beam:
    return Beam(
        length,
        (
            Support("a", SupportKind.PIN, 0.0),
            Support("b", SupportKind.ROLLER, length),
        ),
        loads,
        material=MATERIAL,
        section=SECTION,
    )


def test_omitted_properties_preserve_statics_only_result() -> None:
    beam = Beam(
        4.0,
        (Support("a", SupportKind.PIN, 0.0), Support("b", SupportKind.ROLLER, 4.0)),
    )
    assert analyze(beam).deflection is None


def test_simply_supported_central_point_load() -> None:
    length, load = 6.0, 12.0
    result = analyze(simply_supported((PointLoad("p", length / 2, -load),), length))
    assert result.deflection is not None
    extreme = result.deflection.max_downward
    assert extreme is not None
    assert extreme.x == pytest.approx(length / 2)
    assert extreme.value == pytest.approx(-(load * length**3) / (48 * EI))
    assert result.deflection.max_upward is None


def test_simply_supported_full_udl() -> None:
    length, load = 5.0, 8.0
    result = analyze(simply_supported((DistributedLoad("w", 0.0, length, -load, -load),), length))
    assert result.deflection is not None
    extreme = result.deflection.max_downward
    assert extreme is not None
    assert extreme.x == pytest.approx(length / 2)
    assert extreme.value == pytest.approx(-(5 * load * length**4) / (384 * EI))


def test_cantilever_tip_load_deflection_and_slope() -> None:
    length, load = 3.0, 10.0
    beam = Beam(
        length,
        (Support("f", SupportKind.FIXED, 0.0),),
        (PointLoad("p", length, -load),),
        material=MATERIAL,
        section=SECTION,
    )
    result = analyze(beam)
    assert result.deflection is not None
    segment = result.deflection.segments[-1]
    t = segment.x_end - segment.x_start
    assert segment.deflection_poly()(t) == pytest.approx(-(load * length**3) / (3 * EI))
    assert segment.slope_poly()(t) == pytest.approx(-(load * length**2) / (2 * EI))


def test_cantilever_full_udl() -> None:
    length, load = 4.0, 3.0
    beam = Beam(
        length,
        (Support("f", SupportKind.FIXED, 0.0),),
        (DistributedLoad("w", 0.0, length, -load, -load),),
        material=MATERIAL,
        section=SECTION,
    )
    result = analyze(beam)
    assert result.deflection is not None
    assert result.deflection.max_downward is not None
    assert result.deflection.max_downward.value == pytest.approx(-(load * length**4) / (8 * EI))


def test_internal_hinge_keeps_displacement_continuous_and_allows_slope_jump() -> None:
    # Fixed-pinned Gerber beam: the hinge supplies the extra equilibrium equation.
    beam = Beam(
        8.0,
        (
            Support("f", SupportKind.FIXED, 0.0),
            Support("r", SupportKind.ROLLER, 8.0),
        ),
        (PointLoad("p", 6.0, -10.0),),
        hinges=(4.0,),
        material=MATERIAL,
        section=SECTION,
    )
    result = analyze(beam)
    assert result.deflection is not None
    left = next(s for s in result.deflection.segments if s.x_end == 4.0)
    right = next(s for s in result.deflection.segments if s.x_start == 4.0)
    assert left.deflection_poly()(left.x_end - left.x_start) == pytest.approx(
        right.deflection_poly()(0.0)
    )
    assert left.slope_poly()(left.x_end - left.x_start) != pytest.approx(right.slope_poly()(0.0))


def test_stepped_cantilever_deflection_and_continuity() -> None:
    # Cantilever L=4, fixed at 0, tip load -10 at 4
    # Span 1 [0, 2] with Section 1, Span 2 [2, 4] with Section 2
    from beam_solver.domain import PropertySpan

    sec1 = RectangularSection(0.2, 0.4)  # stiffer
    sec2 = RectangularSection(0.2, 0.2)  # more flexible
    mat = Material(200.0, 250.0)
    ei1 = mat.young_modulus_kn_m2 * sec1.second_moment
    ei2 = mat.young_modulus_kn_m2 * sec2.second_moment

    span1 = PropertySpan(0.0, 2.0, mat, sec1)
    span2 = PropertySpan(2.0, 4.0, mat, sec2)

    beam = Beam(
        4.0,
        (Support("f", SupportKind.FIXED, 0.0),),
        (PointLoad("p", 4.0, -10.0),),
        spans=(span1, span2),
    )
    result = analyze(beam)
    assert result.deflection is not None
    assert len(result.deflection.segments) == 2

    seg1 = result.deflection.segments[0]
    seg2 = result.deflection.segments[1]

    # Check continuity at boundary x = 2
    assert seg1.deflection_poly()(2.0) == pytest.approx(seg2.deflection_poly()(0.0))
    assert seg1.slope_poly()(2.0) == pytest.approx(seg2.slope_poly()(0.0))

    # Analytical tip slope and deflection
    expected_tip_slope = -60.0 / ei1 - 20.0 / ei2
    expected_tip_deflection = -(560.0 / 3.0) / ei1 - (80.0 / 3.0) / ei2

    assert seg2.slope_poly()(2.0) == pytest.approx(expected_tip_slope)
    assert seg2.deflection_poly()(2.0) == pytest.approx(expected_tip_deflection)
    assert result.deflection.max_downward is not None
    assert result.deflection.max_downward.value == pytest.approx(expected_tip_deflection)
