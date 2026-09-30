"""Hand-solved cases (plan.md Section 8.1)."""

from typing import Any

import pytest
from conftest import beam_from_fixture, load_fixtures

from beam_solver.analysis import AnalysisResult, Side, analyze

FIXTURES = load_fixtures()
TOL = 1e-9


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_hand_case(fixture: dict[str, Any]) -> None:
    result = analyze(beam_from_fixture(fixture["input"]))
    for check in fixture["checks"]:
        check_value(result, check)


def check_value(result: AnalysisResult, check: dict[str, Any]) -> None:
    if "reaction" in check:
        r = next(r for r in result.reactions if r.support_id == check["reaction"])
        assert (r.fx, r.fy, r.moment) == pytest.approx(
            (check["fx"], check["fy"], check["moment"]), abs=TOL
        )
    elif "axial" in check:
        assert result.axial_at(check["x"], side=Side(check["side"])) == pytest.approx(
            check["axial"], abs=TOL
        )
    elif "shear" in check:
        assert result.shear_at(check["x"], side=Side(check["side"])) == pytest.approx(
            check["shear"], abs=TOL
        )
    elif "moment" in check:
        assert result.moment_at(check["x"], side=Side(check["side"])) == pytest.approx(
            check["moment"], abs=TOL
        )
    elif "extreme" in check:
        extreme = getattr(result, check["extreme"])
        if check["x"] is None:
            assert extreme is None
        else:
            assert extreme is not None
            assert (extreme.x, extreme.value) == pytest.approx(
                (check["x"], check["value"]), abs=1e-7
            )
    elif "zero_shear" in check:
        assert any(abs(x - check["zero_shear"]) < 1e-7 for x in result.zero_shear_points)
    elif "classification" in check:
        c = result.classification
        expected = check["classification"]
        assert c.status.value == expected["status"]
        assert (c.axial_degree, c.bending_degree) == (
            expected["axial_degree"],
            expected["bending_degree"],
        )
    else:
        raise AssertionError(f"unknown check {check}")
