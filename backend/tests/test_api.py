"""FastAPI endpoint, error envelope and OpenAPI contract (milestone M5)."""

import sys
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("fastapi")
from conftest import load_fixtures
from fastapi.testclient import TestClient
from test_io_cli import approx_json

from beam_solver.api.app import create_app

FIXTURES = load_fixtures()
URL = "/api/v1/analyze"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app(), raise_server_exceptions=False)


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_fixtures(client: TestClient, fixture: dict[str, Any]) -> None:
    response = client.post(URL, json=fixture["input"])
    assert response.status_code == 200
    assert response.json() == approx_json(fixture["output"])


def roller_only() -> dict[str, Any]:
    return {"length": 6, "supports": [{"id": "a", "type": "roller", "position": 0}]}


def test_unstable(client: TestClient) -> None:
    response = client.post(URL, json=roller_only())
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "unstable"
    assert error["details"]["classification"]["restraints"] == 1


def test_indeterminate(client: TestClient) -> None:
    body = {
        "length": 6,
        "supports": [
            {"id": "a", "type": "fixed", "position": 0},
            {"id": "b", "type": "roller", "position": 6},
        ],
    }
    res = client.post(URL, json=body).json()
    assert res["classification"]["status"] == "indeterminate"
    assert res["classification"]["bending_degree"] == 1
    assert len(res["reactions"]) == 2


def test_domain_validation(client: TestClient) -> None:
    body = roller_only() | {"loads": [{"id": "p", "type": "point", "position": 9, "magnitude": 1}]}
    body["supports"] = [{"id": "a", "type": "fixed", "position": 0}]
    response = client.post(URL, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_position"


def test_invalid_section_uses_error_envelope(client: TestClient) -> None:
    response = client.post(
        URL,
        json={
            "length": 6,
            "supports": [{"id": "a", "type": "fixed", "position": 0}],
            "material": {"young_modulus_gpa": 200, "yield_strength_mpa": 250},
            "section": {
                "type": "rectangle",
                "width": 0.2,
                "height": 0.2,
                "wall_thickness": 0.1,
            },
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_section"


def test_physical_properties_add_deflection_result(client: TestClient) -> None:
    response = client.post(
        URL,
        json={
            "length": 6,
            "supports": [
                {"id": "a", "type": "pin", "position": 0},
                {"id": "b", "type": "roller", "position": 6},
            ],
            "loads": [{"id": "p", "type": "point", "position": 3, "magnitude": -10}],
            "material": {"young_modulus_gpa": 200, "yield_strength_mpa": 250},
            "section": {"type": "rectangle", "width": 0.2, "height": 0.3},
        },
    )
    assert response.status_code == 200
    physical = response.json()["deflection"]
    assert physical["max_downward"]["x"] == pytest.approx(3)
    assert physical["max_downward"]["value"] < 0
    assert physical["segments"]


def test_schema_validation_uses_envelope(client: TestClient) -> None:
    response = client.post(URL, json={"length": -1})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_input"
    assert error["details"]["errors"]


def test_openapi_snapshot_is_current() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from export_openapi import OUT, openapi_text

    assert OUT.exists(), "run scripts/export_openapi.py"
    assert OUT.read_text() == openapi_text(), "run scripts/export_openapi.py"


def test_steps_are_opt_in(client: TestClient) -> None:
    body = FIXTURES[0]["input"]
    assert "steps" not in client.post(URL, json=body).json()
    data = client.post(URL + "?steps=true", json=body).json()
    assert data["steps"], "expected worked steps"
    assert {s["group"] for s in data["steps"]} == {"reactions", "diagrams", "extremes"}
    # everything else is unchanged by the flag
    assert {k: v for k, v in data.items() if k != "steps"} == approx_json(FIXTURES[0]["output"])


def test_balanced_axial_loads_are_indeterminate(client: TestClient) -> None:
    response = client.post(
        URL,
        json={
            "length": 6,
            "supports": [
                {"id": "a", "type": "pin", "position": 0},
                {"id": "b", "type": "pin", "position": 6},
            ],
            "loads": [
                {"id": "p", "type": "point", "position": 2, "magnitude": 0, "fx": 10},
                {"id": "q", "type": "point", "position": 4, "magnitude": 0, "fx": -10},
            ],
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["classification"]["status"] == "indeterminate"
    assert res["classification"]["axial_degree"] == 1
    assert len(res["reactions"]) == 2
