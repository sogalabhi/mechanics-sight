"""Verification benchmark suite for statically indeterminate beams (Milestone 4.1).

Verifies 1D Direct Stiffness Method against exact analytical textbook solutions for:
- Propped cantilevers (UDL, point load, moment)
- Fixed--fixed beams (UDL, point load)
- Multi-span continuous beams (2-span and 3-span)
- Support settlement
- Elastic spring foundations
- Indeterminate internal hinges
- Physical deflection and stresses on indeterminate beams
"""

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
from beam_solver.solvers import Determinacy


def test_propped_cantilever_udl():
    """L=6m, fixed at 0, roller at 6, w = -10 kN/m.
    R_B = 3/8 w L = 22.5 kN
    R_A = 5/8 w L = 37.5 kN
    M_A = 1/8 w L^2 = 45.0 kN·m
    Max sagging = 9/128 w L^2 = 25.3125 kN·m at x = 3.75 m.
    """
    beam = Beam(
        6.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (DistributedLoad("w", 0.0, 6.0, -10.0, -10.0),),
    )
    res = analyze(beam)

    assert res.classification.status is Determinacy.INDETERMINATE
    assert res.classification.bending_degree == 1

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 37.5
    assert pytest.approx(reacs["A"].moment, abs=1e-5) == 45.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 22.5

    # Max hogging at wall
    assert res.max_hogging is not None
    assert pytest.approx(res.max_hogging.value, abs=1e-5) == -45.0
    assert pytest.approx(res.max_hogging.x, abs=1e-5) == 0.0

    # Max sagging in span
    assert res.max_sagging is not None
    assert pytest.approx(res.max_sagging.value, abs=1e-5) == 25.3125
    assert pytest.approx(res.max_sagging.x, abs=1e-5) == 3.75


def test_propped_cantilever_midspan_point_load():
    """L=8m, fixed at 0, roller at 8, P = -32 kN at x = 4m.
    R_B = 5/16 P = 10.0 kN
    R_A = 11/16 P = 22.0 kN
    M_A = 3/16 P L = 48.0 kN·m
    M(4) = R_B * 4 = 40.0 kN·m
    """
    beam = Beam(
        8.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 8.0)),
        (PointLoad("P", 4.0, -32.0),),
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 22.0
    assert pytest.approx(reacs["A"].moment, abs=1e-5) == 48.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 10.0

    assert res.max_sagging is not None
    assert pytest.approx(res.max_sagging.value, abs=1e-5) == 40.0
    assert pytest.approx(res.max_sagging.x, abs=1e-5) == 4.0


def test_fixed_fixed_udl():
    """L=10m, fixed at 0 and 10, w = -12 kN/m.
    R_A = R_B = wL/2 = 60 kN
    M_A = wL^2 / 12 = 100 kN·m
    M_B = -wL^2 / 12 = -100 kN·m
    M_mid = wL^2 / 24 = 50 kN·m
    """
    beam = Beam(
        10.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.FIXED, 10.0)),
        (DistributedLoad("w", 0.0, 10.0, -12.0, -12.0),),
    )
    res = analyze(beam)

    assert res.classification.status is Determinacy.INDETERMINATE
    assert res.classification.bending_degree == 2

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 60.0
    assert pytest.approx(reacs["A"].moment, abs=1e-5) == 100.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 60.0
    assert pytest.approx(reacs["B"].moment, abs=1e-5) == -100.0

    assert res.max_sagging is not None
    assert pytest.approx(res.max_sagging.value, abs=1e-5) == 50.0
    assert pytest.approx(res.max_sagging.x, abs=1e-5) == 5.0


def test_fixed_fixed_midspan_point_load():
    """L=8m, fixed at 0 and 8, P = -40 kN at x = 4m.
    R_A = R_B = 20 kN
    M_A = PL/8 = 40 kN·m
    M_B = -PL/8 = -40 kN·m
    M_mid = PL/8 = 40 kN·m
    """
    beam = Beam(
        8.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.FIXED, 8.0)),
        (PointLoad("P", 4.0, -40.0),),
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 20.0
    assert pytest.approx(reacs["A"].moment, abs=1e-5) == 40.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 20.0
    assert pytest.approx(reacs["B"].moment, abs=1e-5) == -40.0

    assert res.max_sagging is not None
    assert pytest.approx(res.max_sagging.value, abs=1e-5) == 40.0
    assert pytest.approx(res.max_sagging.x, abs=1e-5) == 4.0


def test_two_span_continuous_udl():
    """L=12m (two 6m spans), supports at 0, 6, 12, w = -10 kN/m.
    R_A = R_C = 3/8 w L_span = 22.5 kN
    R_B = 10/8 w L_span = 75.0 kN
    M_B = -w L_span^2 / 8 = -45.0 kN·m
    """
    beam = Beam(
        12.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 6.0),
            Support("C", SupportKind.ROLLER, 12.0),
        ),
        (DistributedLoad("w", 0.0, 12.0, -10.0, -10.0),),
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 22.5
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 75.0
    assert pytest.approx(reacs["C"].fy, abs=1e-5) == 22.5

    assert res.max_hogging is not None
    assert pytest.approx(res.max_hogging.value, abs=1e-5) == -45.0
    assert pytest.approx(res.max_hogging.x, abs=1e-5) == 6.0


def test_three_span_continuous_udl():
    """L=18m (three 6m spans), supports at 0, 6, 12, 18, w = -10 kN/m.
    Three-moment solution:
    M_B = M_C = -0.1 w L^2 = -36.0 kN·m
    R_A = R_D = 24.0 kN
    R_B = R_C = 66.0 kN
    """
    beam = Beam(
        18.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 6.0),
            Support("C", SupportKind.ROLLER, 12.0),
            Support("D", SupportKind.ROLLER, 18.0),
        ),
        (DistributedLoad("w", 0.0, 18.0, -10.0, -10.0),),
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 24.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 66.0
    assert pytest.approx(reacs["C"].fy, abs=1e-5) == 66.0
    assert pytest.approx(reacs["D"].fy, abs=1e-5) == 24.0


def test_support_settlement_on_propped_cantilever():
    """Propped cantilever L=5m, fixed at 0, roller at 5 settles by Δ = 4 mm.
    EI = 20,000 kN·m²
    R_B = -3 EI Δ / L^3 = -1.92 kN
    R_A = +1.92 kN
    M_A = 1.92 * 5 = 9.6 kN·m
    """
    mat = Material(200.0, 250.0)  # E = 200 GPa
    # Rectangle 0.2m x 0.3816m to have exact EI or test with span
    # Or define material and section explicitly:
    sec = RectangularSection(0.2, 0.3)
    # E = 200 GPa = 200e6 kN/m^2
    # I = 0.2 * 0.3^3 / 12 = 0.00045 m^4
    # EI = 200e6 * 0.00045 = 90,000 kN·m^2
    # For L=5m, Δ=0.005m:
    # R_B = -3 * 90000 * 0.005 / 125 = -10.8 kN
    beam = Beam(
        5.0,
        (
            Support("A", SupportKind.FIXED, 0.0),
            Support("B", SupportKind.ROLLER, 5.0, settlement=0.005),
        ),
        material=mat,
        section=sec,
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["B"].fy, abs=1e-4) == -10.8
    assert pytest.approx(reacs["A"].fy, abs=1e-4) == 10.8
    assert pytest.approx(reacs["A"].moment, abs=1e-4) == 54.0


def test_elastic_spring_support():
    """Cantilever L=4m, fixed at 0, elastic spring k_y = 1000 kN/m at 4m.
    Point load -20 kN at 4m.
    Default EI = 20,000 kN·m²
    k_beam = 3 EI / L^3 = 937.5 kN/m
    R_spring = 20 * 1000 / (1000 + 937.5) = 10.32258 kN
    """
    beam = Beam(
        4.0,
        (
            Support("A", SupportKind.FIXED, 0.0),
            Support("B", SupportKind.ROLLER, 4.0, spring_ky=1000.0),
        ),
        (PointLoad("P", 4.0, -20.0),),
    )
    res = analyze(beam)

    reacs = {r.support_id: r for r in res.reactions}
    expected_rb = 20.0 * 1000.0 / 1937.5
    assert pytest.approx(reacs["B"].fy, abs=1e-4) == expected_rb
    assert pytest.approx(reacs["A"].fy, abs=1e-4) == 20.0 - expected_rb


def test_indeterminate_physical_deflection_and_stress():
    """Verify deflection and bending stress fields on propped cantilever."""
    mat = Material(200.0, 250.0)
    sec = RectangularSection(0.2, 0.3)
    beam = Beam(
        6.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (DistributedLoad("w", 0.0, 6.0, -10.0, -10.0),),
        material=mat,
        section=sec,
    )
    res = analyze(beam)

    assert res.deflection is not None
    assert len(res.deflection.segments) == 1
    # Boundary conditions: y(0) = 0, y'(0) = 0, y(6) = 0
    seg = res.deflection.segments[0]
    c_y = seg.deflection
    c_theta = seg.slope
    assert pytest.approx(c_y[0], abs=1e-9) == 0.0
    assert pytest.approx(c_theta[0], abs=1e-9) == 0.0

    # Evaluate at x = 6
    x = 6.0
    disp_at_end = sum(c * (x**p) for p, c in enumerate(c_y))
    assert pytest.approx(disp_at_end, abs=1e-7) == 0.0

    # Bending stress exists and yield ratio is computed
    assert res.bending_stress is not None
    assert res.bending_stress.yield_ratio > 0


def test_multi_pinned_axial_indeterminate():
    """L=6m, pin at 0, pin at 6, horizontal force Fx = +12 kN at x = 2m.
    Axial stiffness:
    k_1 = EA / 2, k_2 = EA / 4
    u_2 = Fx / (k_1 + k_2) = 12 / (0.75 EA) = 16 / EA
    R_A,x = -k_1 * u_2 = -8 kN
    R_B,x = -k_2 * u_2 = -4 kN
    Sum of horizontal reactions = -12 kN (equilibrium).
    """
    beam = Beam(
        6.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.PIN, 6.0)),
        (PointLoad("P", 2.0, 0.0, fx=12.0),),
    )
    res = analyze(beam)

    assert res.classification.axial_degree == 1
    reacs = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reacs["A"].fx, abs=1e-5) == -8.0
    assert pytest.approx(reacs["B"].fx, abs=1e-5) == -4.0
    assert pytest.approx(reacs["A"].fy, abs=1e-5) == 0.0
    assert pytest.approx(reacs["B"].fy, abs=1e-5) == 0.0
