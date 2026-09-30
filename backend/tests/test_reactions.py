"""Reactions for the hand cases and the error cases (plan.md Section 8)."""

from typing import Any

import pytest
from conftest import beam_from_fixture, load_fixtures

from beam_solver.domain import Beam, PointLoad, Support, SupportKind
from beam_solver.errors import UnstableBeamError
from beam_solver.solvers import Determinacy, solve_reactions

FIXTURES = load_fixtures()
PIN, ROLLER, FIXED = SupportKind.PIN, SupportKind.ROLLER, SupportKind.FIXED


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_hand_case_reactions(fixture: dict[str, Any]) -> None:
    solution = solve_reactions(beam_from_fixture(fixture["input"]))
    by_id = {r.support_id: r for r in solution.reactions}
    for check in fixture["checks"]:
        if "reaction" in check:
            r = by_id[check["reaction"]]
            assert r.fx == pytest.approx(check["fx"], abs=1e-9)
            assert r.fy == pytest.approx(check["fy"], abs=1e-9)
            assert r.moment == pytest.approx(check["moment"], abs=1e-9)
        if "classification" in check:
            c = solution.classification
            assert c.status.value == check["classification"]["status"]
            assert c.axial_degree == check["classification"]["axial_degree"]
            assert c.bending_degree == check["classification"]["bending_degree"]


def test_pin_pin_warns() -> None:
    beam = Beam(6.0, (Support("a", PIN, 0), Support("b", PIN, 6)), (PointLoad("p", 3, -10),))
    solution = solve_reactions(beam)
    assert solution.classification.status is Determinacy.INDETERMINATE
    assert solution.warnings


def beam_with(*supports: tuple[SupportKind, float]) -> Beam:
    return Beam(
        6.0,
        tuple(Support(f"s{i}", k, x) for i, (k, x) in enumerate(supports)),
        (PointLoad("p", 2.0, -10.0),),
    )


@pytest.mark.parametrize(
    "supports",
    [
        [(ROLLER, 0)],
        [(ROLLER, 0), (ROLLER, 6)],
        [(PIN, 0)],
        [(ROLLER, 0), (ROLLER, 3), (ROLLER, 6)],
    ],
)
def test_unstable(supports: list[tuple[SupportKind, float]]) -> None:
    with pytest.raises(UnstableBeamError) as info:
        solve_reactions(beam_with(*supports))
    assert info.value.classification.status is Determinacy.UNSTABLE


@pytest.mark.parametrize(
    ("supports", "degree"),
    [
        ([(FIXED, 0), (ROLLER, 6)], 1),
        ([(PIN, 0), (ROLLER, 3), (ROLLER, 6)], 1),
        ([(FIXED, 0), (FIXED, 6)], 3),
    ],
)
def test_indeterminate(supports: list[tuple[SupportKind, float]], degree: int) -> None:
    sol = solve_reactions(beam_with(*supports))
    assert sol.classification.status is Determinacy.INDETERMINATE
    assert sol.classification.degree == degree
    assert len(sol.reactions) == len(supports)
