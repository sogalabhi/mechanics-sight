"""Tests for bending stress calculations."""

import math

import pytest

from beam_solver.analysis.bending_stress import solve_bending_stress
from beam_solver.analysis.results import Segment
from beam_solver.domain import Beam, Material, PointLoad, RectangularSection, Support, SupportKind
from beam_solver.errors import SolverConsistencyError


def test_bending_stress_basic() -> None:
    # 5m simply supported beam, 10kN point load at midspan
    # M_max = PL/4 = 10 * 5 / 4 = 12.5 kN·m
    # Rectangular section: 0.1m width, 0.2m height
    # I = bd³/12 = 0.1 * 0.2³ / 12 = 6.6667e-5 m⁴
    # y_top = 0.1m, y_bottom = -0.1m
    # σ_top = -M * y_top / I = -12.5 * 0.1 / 6.6667e-5 = -18750 kN/m² (compression)
    # σ_bot = -M * y_bottom / I = -12.5 * -0.1 / 6.6667e-5 = 18750 kN/m² (tension)
    
    mat = Material(young_modulus_gpa=200, yield_strength_mpa=250)
    sec = RectangularSection(width=0.1, height=0.2)
    beam = Beam(
        length=5.0,
        supports=(
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 5.0),
        ),
        loads=(PointLoad("P1", 2.5, -10.0),),
        material=mat,
        section=sec,
    )
    
    # 0 to 2.5: V = 5, M = 5x
    # 2.5 to 5: V = -5, M = 12.5 - 5(x-2.5) = 25 - 5x
    segments = [
        Segment(0.0, 2.5, shear=(5.0,), moment=(0.0, 5.0)),
        Segment(2.5, 5.0, shear=(-5.0,), moment=(12.5, -5.0)),
    ]
    
    result = solve_bending_stress(beam, segments)
    
    assert len(result.segments) == 2
    
    assert result.max_tension is not None
    assert result.max_compression is not None
    assert math.isclose(result.max_tension.value, 18750.0)
    assert math.isclose(result.max_compression.value, -18750.0)
    assert math.isclose(result.max_tension.x, 2.5)
    
    assert not result.yield_exceeded
    assert math.isclose(result.yield_ratio, 18750.0 / (250 * 1000))
    assert result.yield_location is not None
    assert math.isclose(result.yield_location.x, 2.5)


def test_missing_properties() -> None:
    beam = Beam(
        length=5.0,
        supports=(
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 5.0),
        ),
    )
    with pytest.raises(SolverConsistencyError):
        solve_bending_stress(beam, [])


def test_stepped_beam_bending_stress() -> None:
    from beam_solver.analysis import analyze
    from beam_solver.domain import PropertySpan

    mat = Material(young_modulus_gpa=200, yield_strength_mpa=250)
    sec1 = RectangularSection(width=0.1, height=0.2)  # smaller: I = 6.6667e-5
    sec2 = RectangularSection(width=0.1, height=0.4)  # larger: I = 5.3333e-4

    span1 = PropertySpan(0.0, 2.0, mat, sec1)
    span2 = PropertySpan(2.0, 4.0, mat, sec2)

    beam = Beam(
        length=4.0,
        supports=(Support("f", SupportKind.FIXED, 0.0),),
        loads=(PointLoad("p", 4.0, -10.0),),
        spans=(span1, span2),
    )
    result = analyze(beam)
    assert result.bending_stress is not None
    assert len(result.bending_stress.segments) == 2

    # In span 1 at x=0: M = -40, sigma_top = -(-40)*0.1 / (0.1*0.2^3/12) = 60000 kN/m²
    seg1 = result.bending_stress.segments[0]
    assert math.isclose(seg1.sigma_top_poly()(0.0), 60000.0)

    # In span 1 at x=2-: M = -20, sigma_top = 30000 kN/m²
    assert math.isclose(seg1.sigma_top_poly()(2.0), 30000.0)

    # In span 2 at x=2+: M = -20, sigma_top = -(-20)*0.2 / (0.1*0.4^3/12) = 7500 kN/m²
    seg2 = result.bending_stress.segments[1]
    assert math.isclose(seg2.sigma_top_poly()(0.0), 7500.0)

