"""io schemas, conversion, snapshots and the CLI (milestone M4)."""

import json
from pathlib import Path
from typing import Any

import pytest
from conftest import load_fixtures
from pydantic import ValidationError

from beam_solver.analysis import analyze
from beam_solver.cli import main
from beam_solver.errors import InvalidSectionError, UnstableBeamError
from beam_solver.io import BeamIn, beam_from_json, error_to_schema, result_to_json

FIXTURES = load_fixtures()
ROLLER_ONLY = {"length": 6, "supports": [{"id": "a", "type": "roller", "position": 0}]}


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_snapshot(fixture: dict[str, Any]) -> None:
    """Output must match the committed snapshot (run scripts/update_snapshots.py)."""
    assert "output" in fixture, "run scripts/update_snapshots.py"
    beam = beam_from_json(fixture["input"])
    actual = result_to_json(analyze(beam), beam=beam)
    assert actual == approx_json(fixture["output"])


def approx_json(expected: Any) -> Any:
    if isinstance(expected, dict):
        return {k: approx_json(v) for k, v in expected.items()}
    if isinstance(expected, list):
        return [approx_json(v) for v in expected]
    if isinstance(expected, float):
        return pytest.approx(expected, abs=1e-9, rel=1e-9)
    return expected


def test_unknown_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        BeamIn.model_validate(
            {"length": 6, "supports": [{"id": "a", "type": "pin", "position": 0, "x": 1}]}
        )


@pytest.mark.parametrize(
    "section",
    [
        {"type": "rectangle", "width": 0.2, "height": 0.3},
        {"type": "rectangle", "width": 0.2, "height": 0.3, "wall_thickness": 0.02},
        {"type": "circle", "diameter": 0.2},
        {"type": "circle", "diameter": 0.2, "wall_thickness": 0.01},
        {
            "type": "i",
            "height": 0.3,
            "flange_width": 0.15,
            "flange_thickness": 0.02,
            "web_thickness": 0.01,
        },
        {
            "type": "t",
            "flange_width": 0.15,
            "flange_thickness": 0.02,
            "web_depth": 0.28,
            "web_thickness": 0.01,
        },
    ],
)
def test_physical_properties_schema_round_trip(section: dict[str, Any]) -> None:
    data = {
        "length": 6,
        "supports": [{"id": "a", "type": "fixed", "position": 0}],
        "material": {"young_modulus_gpa": 200, "yield_strength_mpa": 250},
        "section": section,
    }
    model = BeamIn.model_validate(data)
    beam = beam_from_json(model.model_dump(mode="json"))
    assert beam.material is not None
    assert beam.material.young_modulus_kn_m2 == 200_000_000
    assert beam.section is not None


def test_physical_properties_must_be_paired() -> None:
    with pytest.raises(ValidationError, match="supplied together"):
        BeamIn.model_validate(
            {
                "length": 6,
                "supports": [{"id": "a", "type": "fixed", "position": 0}],
                "material": {"young_modulus_gpa": 200, "yield_strength_mpa": 250},
            }
        )


def test_section_relation_validation_uses_domain_error() -> None:
    with pytest.raises(InvalidSectionError, match="inner opening"):
        beam_from_json(
            {
                "length": 6,
                "supports": [{"id": "a", "type": "fixed", "position": 0}],
                "material": {"young_modulus_gpa": 200, "yield_strength_mpa": 250},
                "section": {
                    "type": "circle",
                    "diameter": 0.2,
                    "wall_thickness": 0.1,
                },
            }
        )


def test_limits() -> None:
    with pytest.raises(ValidationError):
        BeamIn.model_validate(
            {"length": 5000, "supports": [{"id": "a", "type": "fixed", "position": 0}]}
        )


def test_error_envelope_has_classification() -> None:
    with pytest.raises(UnstableBeamError) as info:
        analyze(
            beam_from_json(
                {"length": 6, "supports": [{"id": "a", "type": "roller", "position": 0}]}
            )
        )
    body = error_to_schema(info.value).model_dump()
    assert body["error"]["code"] == "unstable"
    assert body["error"]["details"]["classification"]["status"] == "unstable"


def test_cli_json_and_plot(tmp_path: Path) -> None:
    pytest.importorskip("matplotlib")
    import matplotlib

    matplotlib.use("Agg")
    src = tmp_path / "beam.json"
    src.write_text(json.dumps(FIXTURES[0]["input"]))
    out, png = tmp_path / "out.json", tmp_path / "out.png"
    assert main(["analyze", str(src), "--json", str(out), "--plot", str(png)]) == 0
    assert json.loads(out.read_text())["extremes"]["max_sagging"]["value"] == pytest.approx(15)
    assert png.stat().st_size > 0


def test_cli_errors(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    src = tmp_path / "beam.json"
    src.write_text(
        json.dumps({"length": 6, "supports": [{"id": "a", "type": "roller", "position": 0}]})
    )
    assert main(["analyze", str(src)]) == 1
    assert '"unstable"' in capsys.readouterr().err
    src.write_text("{}")
    assert main(["analyze", str(src)]) == 2
