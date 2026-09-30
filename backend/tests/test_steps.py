"""Worked steps (M6.5): they must agree with the hand-solved fixtures and the solver."""

import json
from pathlib import Path
from typing import Any

import pytest
from conftest import beam_from_fixture, load_fixtures

from beam_solver.analysis import analyze, build_steps
from beam_solver.analysis.steps import _num

FIXTURES = load_fixtures()
IDS = [f["name"] for f in FIXTURES]


def steps_for(fixture: dict[str, Any]) -> tuple[Any, Any, tuple[Any, ...]]:
    beam = beam_from_fixture(fixture["input"])
    result = analyze(beam)
    return beam, result, build_steps(beam, result)


@pytest.mark.parametrize("fixture", FIXTURES, ids=IDS)
def test_solved_reactions_match_hand_checks(fixture: dict[str, Any]) -> None:
    beam, _, steps = steps_for(fixture)
    solved = next(s for s in steps if s.kind == "reactions")
    letters = {
        s.id: chr(ord("A") + i)
        for i, s in enumerate(sorted(beam.supports, key=lambda s: s.position))
    }
    for check in fixture["checks"]:
        if "reaction" not in check:
            continue
        letter = letters[check["reaction"]]
        assert solved.result is not None
        if check["fy"] != 0 or f"R_{{{letter}}}" in solved.result:
            assert f"R_{{{letter}}} = {_num(check['fy'])}" in solved.result
        if check["moment"] != 0:
            assert f"M_{{{letter}}} = {_num(check['moment'])}" in solved.result


@pytest.mark.parametrize("fixture", FIXTURES, ids=IDS)
def test_one_shear_and_moment_step_per_segment(fixture: dict[str, Any]) -> None:
    _, result, steps = steps_for(fixture)
    shear = [s for s in steps if s.kind == "shear"]
    moment = [s for s in steps if s.kind == "moment"]
    assert len(shear) == len(moment) == len(result.segments)
    for step, seg in zip(shear, result.segments, strict=True):
        assert (step.x_start, step.x_end) == (seg.x_start, seg.x_end)


@pytest.mark.parametrize("fixture", FIXTURES, ids=IDS)
def test_extreme_steps_match_result(fixture: dict[str, Any]) -> None:
    _, result, steps = steps_for(fixture)
    extremes = [s for s in steps if s.kind == "extreme"]
    expected = [
        e
        for e in (
            result.max_sagging,
            result.max_hogging,
            result.max_positive_shear,
            result.max_negative_shear,
        )
        if e is not None
    ]
    assert len(extremes) == len(expected)
    for step, e in zip(extremes, expected, strict=True):
        assert step.result is not None
        assert _num(e.value) in step.result
        assert step.at == e.x


def test_central_point_load_working() -> None:
    fixture = next(f for f in FIXTURES if f["name"] == "01_ss_central_point")
    _, _, steps = steps_for(fixture)
    by_kind = {s.kind: s for s in steps}
    assert by_kind["force_balance"].result == "R_{A} + R_{B} = 10"
    assert by_kind["moment_balance"].result == "6\\,R_{B} = 30"
    assert by_kind["zero_shear"].title == "The shear changes sign at x = 3 m"
    moments = [s for s in steps if s.kind == "moment"]
    assert [m.result for m in moments] == ["M(x) = 5\\,x", "M(x) = -5\\,x + 30"]


def test_triangular_load_keeps_small_coefficients() -> None:
    fixture = next(f for f in FIXTURES if f["name"] == "07_ss_triangular")
    _, _, steps = steps_for(fixture)
    moment = next(s for s in steps if s.kind == "moment")
    assert moment.result is not None
    assert "0.08333" in moment.result


def test_every_fixture_has_a_hand_solution() -> None:
    docs = Path(__file__).resolve().parents[2] / "docs" / "hand-solutions"
    missing = [f["name"] for f in FIXTURES if not (docs / f"{f['name']}.md").exists()]
    assert not missing, f"no hand solution for: {missing}"


def test_cli_steps_flag(tmp_path: Path) -> None:
    from beam_solver.cli import main

    src = tmp_path / "beam.json"
    src.write_text(json.dumps(FIXTURES[0]["input"]))
    out = tmp_path / "out.json"
    assert main(["analyze", str(src), "--json", str(out), "--steps"]) == 0
    assert json.loads(out.read_text())["steps"]
    assert main(["analyze", str(src), "--json", str(out)]) == 0
    assert "steps" not in json.loads(out.read_text())
