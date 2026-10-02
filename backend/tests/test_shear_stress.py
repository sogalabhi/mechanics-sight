"""Tests for transverse shear stress calculations."""

import math

import pytest

from beam_solver.analysis.results import Segment
from beam_solver.analysis.shear_stress import shear_stress_profile, solve_shear_stress
from beam_solver.domain import Beam, Material, PointLoad, RectangularSection, Support, SupportKind
from beam_solver.errors import SolverConsistencyError


def test_shear_stress_basic() -> None:
    # 5m simply supported beam, 10kN load at x=1
    # V = 8kN (0 to 1), V = -2kN (1 to 5)
    # Rectangular section: 0.1m width, 0.2m height
    # I = 6.6667e-5 m⁴
    # τ_max for rectangle = 1.5 * V / A = 1.5 * 8 / (0.1 * 0.2) = 600 kN/m²

    mat = Material(young_modulus_gpa=200, yield_strength_mpa=250)
    sec = RectangularSection(width=0.1, height=0.2)
    beam = Beam(
        length=5.0,
        supports=(
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 5.0),
        ),
        loads=(PointLoad("P1", 1.0, -10.0),),
        material=mat,
        section=sec,
    )

    segments = [
        Segment(0.0, 1.0, shear=(8.0,), moment=(0.0, 8.0)),
        Segment(1.0, 5.0, shear=(-2.0,), moment=(8.0, -2.0)),
    ]

    result = solve_shear_stress(beam, segments)

    assert result.max_shear_stress is not None
    assert math.isclose(result.max_shear_stress.value, 600.0)
    assert result.max_shear_stress.x <= 1.0


def test_shear_stress_profile() -> None:
    sec = RectangularSection(width=0.1, height=0.2)
    # y ranges from -0.1 to 0.1
    profile = shear_stress_profile(sec, shear_force=8.0, n_points=2)

    assert len(profile.y_values) == 3
    assert profile.y_values[0] == -0.1
    assert profile.y_values[1] == 0.0
    assert profile.y_values[2] == 0.1

    assert math.isclose(profile.tau_values[0], 0.0, abs_tol=1e-9)
    assert math.isclose(profile.tau_values[1], 600.0)
    assert math.isclose(profile.tau_values[2], 0.0, abs_tol=1e-9)


def test_missing_properties() -> None:
    beam = Beam(
        length=5.0,
        supports=(
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 5.0),
        ),
    )
    with pytest.raises(SolverConsistencyError):
        solve_shear_stress(beam, [])


def test_stepped_beam_shear_stress() -> None:
    from beam_solver.analysis import analyze
    from beam_solver.domain import PropertySpan

    mat = Material(young_modulus_gpa=200, yield_strength_mpa=250)
    # Span 1 [0, 2]: width=0.1, height=0.2 => A = 0.02, tau_max = 1.5 * 10 / 0.02 = 750 kPa
    sec1 = RectangularSection(width=0.1, height=0.2)
    # Span 2 [2, 4]: width=0.1, height=0.4 => A = 0.04, tau_max = 1.5 * 10 / 0.04 = 375 kPa
    sec2 = RectangularSection(width=0.1, height=0.4)

    span1 = PropertySpan(0.0, 2.0, mat, sec1)
    span2 = PropertySpan(2.0, 4.0, mat, sec2)

    beam = Beam(
        length=4.0,
        supports=(Support("f", SupportKind.FIXED, 0.0),),
        loads=(PointLoad("p", 4.0, -10.0),),
        spans=(span1, span2),
    )
    result = analyze(beam)
    assert result.shear_stress is not None
    assert result.shear_stress.max_shear_stress is not None
    # Maximum shear stress should be in span 1 (smaller section): 750 kPa
    assert math.isclose(result.shear_stress.max_shear_stress.value, 750.0)
    assert result.shear_stress.max_shear_stress.x <= 2.0
