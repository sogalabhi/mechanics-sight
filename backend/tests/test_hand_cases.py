"""Hand-solved cases (plan.md Section 8.1). These fail until the solver exists."""

from typing import Any

import pytest
from conftest import load_fixtures

FIXTURES = load_fixtures()


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_hand_case(fixture: dict[str, Any]) -> None:
    from beam_solver.analysis.analyze import analyze  # type: ignore[attr-defined]
    from beam_solver.io.convert import beam_from_json, result_to_json  # type: ignore[attr-defined]

    result = result_to_json(analyze(beam_from_json(fixture["input"])))
    for check in fixture["checks"]:
        assert check_value(result, check)


def check_value(result: dict[str, Any], check: dict[str, Any]) -> bool:
    raise NotImplementedError("implemented in milestone M3")
