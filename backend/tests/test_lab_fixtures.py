"""Every hand-solved lab fixture (shared/fixtures/lab) must pass against the tension model."""

import json
from pathlib import Path
from typing import Any

import pytest

from beam_solver.errors import LabError
from beam_solver.material import (
    Operation,
    Reset,
    Specimen,
    StrainTo,
    UnloadToZeroStress,
    get_preset,
    run_tension,
)

LAB_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "lab"
FIXTURES = [json.loads(p.read_text()) for p in sorted(LAB_DIR.glob("L*.json"))]
IDS = [f["name"] for f in FIXTURES]


def history_from(raw: list[dict[str, Any]]) -> list[Operation]:
    """Fixture request history -> model operations."""
    out: list[Operation] = []
    for item in raw:
        match item["op"]:
            case "strain":
                out.append(StrainTo(item["to"]))
            case "unload_to_zero_stress":
                out.append(UnloadToZeroStress())
            case "reset":
                out.append(Reset())
            case other:  # pragma: no cover - a fixture bug
                raise AssertionError(f"unknown op {other}")
    return out


def run_fixture(fixture: dict[str, Any]) -> Any:
    request = fixture["input"]
    return run_tension(
        get_preset(request["preset"]),
        Specimen(**request["specimen"]),
        history_from(request["history"]),
    )


def test_all_cases_are_present() -> None:
    assert [f["case"] for f in FIXTURES] == [f"L{n}" for n in range(1, 26)]
    assert {f["milestone"] for f in FIXTURES} == {"S1", "S2"}


@pytest.mark.parametrize("fixture", FIXTURES, ids=IDS)
def test_fixture(fixture: dict[str, Any]) -> None:
    if "expected_error" in fixture:
        with pytest.raises(LabError) as caught:
            run_fixture(fixture)
        assert caught.value.code == fixture["expected_error"]
        return

    result = run_fixture(fixture)
    state = result.state
    tol = fixture["tolerance"]
    expected = fixture["expected"]
    for key in tol:
        assert getattr(state, key) == pytest.approx(expected[key], abs=tol[key]), key
    assert state.max_strain == pytest.approx(expected["max_strain"], abs=tol["strain"])
    assert state.region == expected["region"]
    assert state.landmark == expected["landmark"]
    proof = fixture.get("expected_proof")
    assert result.proof.offset_strain == pytest.approx(0.002)
    if proof:  # the proof point does not depend on the history, but is stated by hand in L24
        assert result.proof.strain == pytest.approx(proof["strain"], abs=1e-12)
        assert result.proof.stress_mpa == pytest.approx(proof["stress_mpa"], abs=1e-9)
    ends = fixture.get("trace_ends_with", [])
    if ends:
        for want, got in zip(ends, result.trace[-len(ends) :], strict=True):
            assert got.strain == pytest.approx(want[0], abs=1e-12)
            assert got.stress_mpa == pytest.approx(want[1], abs=1e-6)
