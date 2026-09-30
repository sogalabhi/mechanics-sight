"""Tests for Phase 2: Internal Hinges (Gerber Beams)."""

import math
import pytest

from beam_solver.analysis import analyze, build_steps
from beam_solver.domain import (
    Beam,
    Direction,
    DistributedLoad,
    PointLoad,
    PointMoment,
    Support,
    SupportKind,
)
from beam_solver.errors import (
    BeamError,
    InvalidBeamError,
    InvalidLoadError,
    InvalidPositionError,
    UnstableBeamError,
)
from beam_solver.io import beam_from_json, result_to_schema
from beam_solver.solvers import Determinacy, EquilibriumSystem, classify, solve_reactions
from beam_solver.tolerances import POSITION_TOL


def test_hinge_domain_validation_boundary():
    """Hinges cannot be at x <= 0 or x >= L."""
    with pytest.raises(InvalidPositionError, match="strictly inside"):
        Beam(10.0, (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)), hinges=(0.0,))

    with pytest.raises(InvalidPositionError, match="strictly inside"):
        Beam(10.0, (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)), hinges=(10.0,))

    with pytest.raises(InvalidPositionError, match="strictly inside"):
        Beam(10.0, (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)), hinges=(-1.0,))

    with pytest.raises(InvalidPositionError, match="strictly inside"):
        Beam(10.0, (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)), hinges=(11.0,))


def test_hinge_domain_validation_fixed_support():
    """Hinge cannot be placed at a fixed support."""
    with pytest.raises(InvalidBeamError, match="cannot place a hinge at fixed support"):
        Beam(
            10.0,
            (Support("fix", SupportKind.FIXED, 0.0), Support("r", SupportKind.ROLLER, 10.0)),
            hinges=(0.0,),
        )


def test_hinge_domain_validation_duplicate():
    """Duplicate hinges within tolerance are forbidden."""
    with pytest.raises(InvalidBeamError, match="duplicate hinges"):
        Beam(
            10.0,
            (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)),
            hinges=(4.0, 4.0),
        )


def test_hinge_domain_validation_point_moment():
    """Applied moment couple directly at hinge is forbidden."""
    with pytest.raises(InvalidLoadError, match="cannot place an applied moment couple directly at an internal hinge"):
        Beam(
            10.0,
            (Support("s1", SupportKind.PIN, 0.0), Support("s2", SupportKind.ROLLER, 10.0)),
            loads=(PointMoment("m1", 4.0, 10.0),),
            hinges=(4.0,),
        )


def test_classic_gerber_beam_point_load():
    """Classic Gerber Beam: Fixed at 0, Roller at 10, Hinge at 6, Point Load at 8.

    A: Fixed at 0 (restraints: X, Y, ROTATION)
    B: Roller at 10 (restraints: Y)
    Hinge at 6
    P = -10 kN at 8

    Free-body of right portion [6, 10]:
      Supported by hinge shear at 6 and Roller B at 10.
      Sum of moments about 6: R_B * 4 - 10 * 2 = 0 => R_B = 5 kN.
      Shear transferred to left beam: 5 kN downward at 6.

    Free-body of left portion [0, 6]:
      Cantilever fixed at 0, loaded by 5 kN downward at 6.
      R_A_y = 5 kN.
      M_A = 5 * 6 = 30 kN*m (anticlockwise).
    """
    beam = Beam(
        10.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 10.0)),
        (PointLoad("P", 8.0, -10.0),),
        hinges=(6.0,),
    )
    res = analyze(beam)

    assert res.classification.status == Determinacy.DETERMINATE
    assert res.classification.equations == 4
    assert res.classification.restraints == 4

    reactions = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reactions["A"].fy, abs=1e-6) == 5.0
    assert pytest.approx(reactions["A"].moment, abs=1e-6) == 30.0
    assert pytest.approx(reactions["B"].fy, abs=1e-6) == 5.0

    # Verify moment at hinge x = 6 is zero
    hinge_pts = [p for p in res.critical_points if abs(p.x - 6.0) < 1e-4]
    assert len(hinge_pts) == 1
    hp = hinge_pts[0]
    assert pytest.approx(hp.moment_left, abs=1e-6) == 0.0
    assert pytest.approx(hp.moment_right, abs=1e-6) == 0.0
    # Shear is continuous across hinge
    assert pytest.approx(hp.shear_left, abs=1e-6) == hp.shear_right


def test_classic_gerber_beam_udl():
    """Gerber Beam under full UDL:
    Fixed at 0, Roller at 8. Hinge at 4.
    w = -2 kN/m over [0, 8].

    Restraints: A (X, Y, M), B (Y) => 4 restraints (3 bending, 1 axial).
    Equations: Fx, Fy, M0, M_hinge => 3 bending equations, 1 axial. Determinate!
    """
    beam = Beam(
        8.0,
        (
            Support("A", SupportKind.FIXED, 0.0),
            Support("B", SupportKind.ROLLER, 8.0),
        ),
        (DistributedLoad("w", 0.0, 8.0, -2.0, -2.0),),
        hinges=(4.0,),
    )
    res = analyze(beam)
    assert res.classification.status == Determinacy.DETERMINATE

    # Moment at hinge x = 4 must be 0
    hp = next(p for p in res.critical_points if abs(p.x - 4.0) < 1e-4)
    assert pytest.approx(hp.moment_left, abs=1e-6) == 0.0
    assert pytest.approx(hp.moment_right, abs=1e-6) == 0.0


def test_three_span_two_hinges_gerber():
    """3-span beam with 2 hinges:
    Pin at 0, Roller at 4, Roller at 8, Roller at 12.
    Hinges at 3.0 and 9.0.
    w = -6 kN/m over [0, 12].

    Restraints: 1 (Pin X) + 4 (Pin/Rollers Y) = 5 restraints.
    Equations: 3 + 2 hinges = 5 equations. Determinate!
    """
    beam = Beam(
        12.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 4.0),
            Support("C", SupportKind.ROLLER, 8.0),
            Support("D", SupportKind.ROLLER, 12.0),
        ),
        (DistributedLoad("w", 0.0, 12.0, -6.0, -6.0),),
        hinges=(3.0, 9.0),
    )
    res = analyze(beam)
    assert res.classification.status == Determinacy.DETERMINATE

    # Check moments at both hinges
    for h_x in (3.0, 9.0):
        hp = next(p for p in res.critical_points if abs(p.x - h_x) < 1e-4)
        assert pytest.approx(hp.moment_left, abs=1e-6) == 0.0
        assert pytest.approx(hp.moment_right, abs=1e-6) == 0.0


def test_unstable_hinge_mechanism():
    """Simply supported beam with a hinge forms a toggle mechanism (unstable)."""
    beam = Beam(
        10.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.ROLLER, 10.0)),
        (PointLoad("P", 5.0, -10.0),),
        hinges=(5.0,),
    )
    system = EquilibriumSystem.from_beam(beam)
    c = classify(system)
    assert c.status == Determinacy.UNSTABLE

    with pytest.raises(UnstableBeamError):
        analyze(beam)


def test_unstable_cantilever_hinge():
    """Cantilever with a hinge: free segment after hinge is unsupported mechanism."""
    beam = Beam(
        10.0,
        (Support("A", SupportKind.FIXED, 0.0),),
        (PointLoad("P", 8.0, -10.0),),
        hinges=(5.0,),
    )
    with pytest.raises(UnstableBeamError):
        analyze(beam)


def test_hinge_json_roundtrip_and_steps():
    """Test JSON serialization and worked steps with internal hinges."""
    payload = {
        "schema_version": 1,
        "length": 10.0,
        "supports": [
            {"id": "A", "type": "fixed", "position": 0.0},
            {"id": "B", "type": "roller", "position": 10.0},
        ],
        "loads": [
            {"id": "P", "type": "point", "position": 8.0, "magnitude": -10.0}
        ],
        "hinges": [6.0],
    }
    beam = beam_from_json(payload)
    assert beam.hinges == (6.0,)

    res = analyze(beam)
    steps = build_steps(beam, res)
    assert steps is not None
    # Check that hinge condition is listed in steps
    titles = [s.title for s in steps]
    assert any("hinge" in t.lower() for t in titles)

    out = result_to_schema(res)
    assert out.classification.status == "determinate"
