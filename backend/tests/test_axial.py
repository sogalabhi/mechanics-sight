"""Tests for Phase 2: Horizontal / Inclined Loads and Axial Force Diagram (AFD)."""

import pytest

from beam_solver.analysis import analyze
from beam_solver.domain import Beam, PointLoad, Support, SupportKind
from beam_solver.errors import IndeterminateBeamError, UnstableBeamError
from beam_solver.io import beam_from_json, result_to_schema
from beam_solver.solvers import Determinacy


def test_inclined_point_load_simply_supported():
    """Pin at 0, Roller at 6. Point load at x = 2 with F_y = -8, F_x = 6."""
    beam = Beam(
        6.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (PointLoad("P", 2.0, magnitude=-8.0, fx=6.0),),
    )
    res = analyze(beam)

    assert res.classification.status == Determinacy.DETERMINATE
    reactions = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reactions["A"].fx, abs=1e-6) == -6.0
    assert pytest.approx(reactions["A"].fy, abs=1e-6) == 5.333333333
    assert pytest.approx(reactions["B"].fy, abs=1e-6) == 2.666666667
    assert pytest.approx(reactions["B"].fx, abs=1e-6) == 0.0

    # Segments axial force
    # [0, 2]: N = +6 kN (tension)
    # [2, 6]: N = 0 kN
    assert len(res.segments) == 2
    seg1, seg2 = res.segments[0], res.segments[1]
    assert pytest.approx(seg1.axial[0], abs=1e-6) == 6.0
    assert pytest.approx(seg2.axial[0], abs=1e-6) == 0.0

    # Critical points: at x = 2, jump in axial force from 6 to 0
    cp2 = next(p for p in res.critical_points if abs(p.x - 2.0) < 1e-4)
    assert pytest.approx(cp2.axial_left, abs=1e-6) == 6.0
    assert pytest.approx(cp2.axial_right, abs=1e-6) == 0.0

    assert res.max_tension is not None
    assert pytest.approx(res.max_tension.value, abs=1e-6) == 6.0
    assert res.max_compression is None


def test_cantilever_axial_compression():
    """Fixed at 0. Point load at x = 5 with F_x = -12 (compression) and F_y = -5."""
    beam = Beam(
        5.0,
        (Support("A", SupportKind.FIXED, 0.0),),
        (PointLoad("P", 5.0, magnitude=-5.0, fx=-12.0),),
    )
    res = analyze(beam)

    reactions = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reactions["A"].fx, abs=1e-6) == 12.0
    assert pytest.approx(reactions["A"].fy, abs=1e-6) == 5.0

    assert len(res.segments) == 1
    seg = res.segments[0]
    # N(x) = -12 kN across the entire beam
    assert pytest.approx(seg.axial[0], abs=1e-6) == -12.0

    assert res.max_compression is not None
    assert pytest.approx(res.max_compression.value, abs=1e-6) == -12.0
    assert res.max_tension is None


def test_multiple_horizontal_loads_tension_and_compression():
    """Pin at 0, Roller at 10.
    Load 1 at 3: fx = +10
    Load 2 at 7: fx = -4
    Reactions: R_Ax = -6 kN.
    [0, 3]: N = +6 kN (tension)
    [3, 7]: N = -4 kN (compression)
    [7, 10]: N = 0 kN
    """
    beam = Beam(
        10.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.ROLLER, 10.0)),
        (
            PointLoad("P1", 3.0, magnitude=-10.0, fx=10.0),
            PointLoad("P2", 7.0, magnitude=-10.0, fx=-4.0),
        ),
    )
    res = analyze(beam)

    reactions = {r.support_id: r for r in res.reactions}
    assert pytest.approx(reactions["A"].fx, abs=1e-6) == -6.0

    assert len(res.segments) == 3
    s1, s2, s3 = res.segments
    assert pytest.approx(s1.axial[0], abs=1e-6) == 6.0
    assert pytest.approx(s2.axial[0], abs=1e-6) == -4.0
    assert pytest.approx(s3.axial[0], abs=1e-6) == 0.0

    assert res.max_tension is not None
    assert pytest.approx(res.max_tension.value, abs=1e-6) == 6.0
    assert res.max_compression is not None
    assert pytest.approx(res.max_compression.value, abs=1e-6) == -4.0


def test_axially_indeterminate_with_horizontal_load_raises():
    """Two pins under horizontal load is axially indeterminate (degree 1)."""
    beam = Beam(
        6.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.PIN, 6.0)),
        (PointLoad("P", 3.0, magnitude=-10.0, fx=5.0),),
    )
    with pytest.raises(IndeterminateBeamError, match="axial force"):
        analyze(beam)


def test_axially_unstable_with_horizontal_load_raises():
    """Two rollers have no horizontal restraint: unstable under horizontal force."""
    beam = Beam(
        6.0,
        (Support("A", SupportKind.ROLLER, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (PointLoad("P", 3.0, magnitude=-10.0, fx=5.0),),
    )
    with pytest.raises(UnstableBeamError):
        analyze(beam)


def test_api_schema_roundtrip_with_fx():
    """Verify JSON serialization and schema roundtrip for inclined load."""
    data = {
        "schema_version": 1,
        "length": 8.0,
        "supports": [
            {"id": "s1", "type": "pin", "position": 0.0},
            {"id": "s2", "type": "roller", "position": 8.0},
        ],
        "loads": [{"id": "p1", "type": "point", "position": 4.0, "magnitude": -15.0, "fx": 10.0}],
    }
    beam = beam_from_json(data)
    assert beam.loads[0].fx == 10.0

    res = analyze(beam)
    out = result_to_schema(res)
    assert out.reactions[0].fx == -10.0
    assert out.segments[0].axial == [10.0]
    assert out.segments[1].axial == [0.0]
    assert out.extremes.max_tension is not None
    assert out.extremes.max_tension.value == 10.0


def test_balanced_horizontal_loads_still_require_axial_compatibility():
    """Zero net force does not imply zero reactions between two pins."""
    beam = Beam(
        6.0,
        (Support("A", SupportKind.PIN, 0.0), Support("B", SupportKind.PIN, 6.0)),
        (PointLoad("p", 2.0, 0.0, fx=10.0), PointLoad("q", 4.0, 0.0, fx=-10.0)),
    )
    with pytest.raises(IndeterminateBeamError, match="axial force"):
        analyze(beam)


@pytest.mark.parametrize(("fixed_x", "load_x", "expected"), [(0.0, 6.0, 7.0), (6.0, 0.0, -7.0)])
def test_axial_sampling_and_exact_boundary_values(fixed_x, load_x, expected):
    from beam_solver.analysis import Side

    result = analyze(
        Beam(
            6.0, (Support("a", SupportKind.FIXED, fixed_x),), (PointLoad("p", load_x, 0.0, fx=7.0),)
        )
    )
    assert result.axial_at(3.0, side=Side.RIGHT) == expected
    assert result.axial_at(0.0, side=Side.LEFT) == 0.0
    assert result.axial_at(6.0, side=Side.RIGHT) == 0.0
    assert result.sample(3).axial == (expected, expected, expected)


def test_axial_working_steps():
    from beam_solver.analysis import build_steps

    beam = Beam(
        6.0,
        (Support("a", SupportKind.PIN, 0.0), Support("b", SupportKind.ROLLER, 6.0)),
        (PointLoad("p", 2.0, -8.0, fx=6.0),),
    )
    steps = build_steps(beam, analyze(beam))
    axial = [step for step in steps if step.kind == "axial"]
    assert len(axial) == 2
    assert axial[0].result == "N(x) = 6"
    assert axial[1].result == "N(x) = 0"
