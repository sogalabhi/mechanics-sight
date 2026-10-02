"""POST /api/v1/lab/tension: the hand-solved fixtures over HTTP, plus request validation."""

import json
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from beam_solver.api.app import create_app

URL = "/api/v1/lab/tension"
LAB_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "lab"
FIXTURES = [json.loads(p.read_text()) for p in sorted(LAB_DIR.glob("L*.json"))]
SPECIMEN = {"diameter_mm": 10, "gauge_length_mm": 50}
STATE_KEYS = (
    "strain",
    "stress_mpa",
    "force_kn",
    "extension_mm",
    "plastic_strain",
    "elastic_strain",
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app(), raise_server_exceptions=False)


def body(history: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "preset": "steel_textbook",
        "specimen": SPECIMEN,
        "history": history,
    } | extra


@pytest.mark.parametrize("fixture", FIXTURES, ids=[f["name"] for f in FIXTURES])
def test_fixture_over_http(client: TestClient, fixture: dict[str, Any]) -> None:
    response = client.post(URL, json=fixture["input"])
    if "expected_error" in fixture:
        assert response.status_code == 422
        assert response.json()["error"]["code"] == fixture["expected_error"]
        return
    assert response.status_code == 200
    out = response.json()
    expected = fixture["expected"]
    for key in STATE_KEYS:
        assert out["state"][key] == pytest.approx(expected[key], abs=fixture["tolerance"][key])
    assert out["state"]["max_strain"] == pytest.approx(expected["max_strain"], abs=1e-12)
    assert out["state"]["region"] == expected["region"]
    assert out["state"]["landmark"] == expected["landmark"]
    ends = fixture.get("trace_ends_with", [])
    for want, got in zip(ends, out["trace"][-len(ends) :] if ends else [], strict=True):
        assert got["strain"] == pytest.approx(want[0], abs=1e-12)
        assert got["stress_mpa"] == pytest.approx(want[1], abs=1e-6)


def test_response_shape(client: TestClient) -> None:
    out = client.post(URL, json=body([{"op": "strain", "to": 0.05}])).json()
    assert set(out) == {
        "schema_version",
        "state",
        "trace",
        "landmarks",
        "model",
        "specimen",
        "warnings",
    }
    assert out["schema_version"] == 1
    assert [m["id"] for m in out["landmarks"]] == list("ABCDEF")
    assert [m["reached"] for m in out["landmarks"]] == [True, True, True, True, False, False]
    model = out["model"]
    assert {k: model[k] for k in ("preset", "name", "kind", "young_modulus_gpa")} == {
        "preset": "steel_textbook",
        "name": "Mild steel, textbook curve",
        "kind": "idealisation",
        "young_modulus_gpa": 200.0,
    }
    assert model["parameters"]["lower_yield_mpa"] == 250.0
    assert model["parameters"]["strain_hardening"] == 0.015
    assert model["parameters"]["strain_fracture"] == 0.25
    assert out["specimen"]["area_mm2"] == pytest.approx(78.5398163, abs=1e-6)
    assert out["trace"][0] == {
        "strain": 0.0,
        "stress_mpa": 0.0,
        "plastic_strain": 0.0,
        "region": "elastic",
    }
    assert out["warnings"] == []


def test_a_fresh_specimen_needs_no_history(client: TestClient) -> None:
    request = {"preset": "steel_textbook", "specimen": SPECIMEN}
    out = client.post(URL, json=request).json()
    assert out["state"]["strain"] == 0.0
    assert out["state"]["region"] == "elastic"


def test_the_response_is_deterministic_and_the_server_keeps_no_state(client: TestClient) -> None:
    first = client.post(URL, json=body([{"op": "strain", "to": 0.1}]))
    other = client.post(URL, json=body([{"op": "strain", "to": 0.2}]))
    again = client.post(URL, json=body([{"op": "strain", "to": 0.1}]))
    assert other.json() != first.json()
    assert again.json() == first.json()


def error_code(client: TestClient, request: dict[str, Any]) -> tuple[int, str]:
    response = client.post(URL, json=request)
    return response.status_code, response.json()["error"]["code"]


def test_domain_errors_use_the_error_envelope(client: TestClient) -> None:
    assert error_code(client, body([{"op": "strain", "to": 0.3}])) == (422, "strain_out_of_range")
    assert error_code(client, body([{"op": "strain", "to": -0.01}])) == (422, "strain_out_of_range")
    assert error_code(client, body([], preset="aluminium")) == (422, "unknown_preset")
    broken = [{"op": "strain", "to": 0.25}, {"op": "unload_to_zero_stress"}]
    assert error_code(client, body(broken)) == (422, "test_finished")
    assert client.post(URL, json=body([{"op": "strain", "to": 0.3}])).json()["error"]["message"]


@pytest.mark.parametrize(
    "request_body",
    [
        body([{"op": "stretch", "to": 0.1}]),  # unknown op
        body([{"op": "strain"}]),  # missing field
        body([{"op": "strain", "to": "lots"}]),  # wrong type
        body([{"op": "strain", "to": 0.1, "extra": 1}]),  # extra field is forbidden
        body([{"op": "unload_to_zero_stress", "to": 0.1}]),
        body([], specimen={"diameter_mm": 0, "gauge_length_mm": 50}),
        body([], specimen={"diameter_mm": 10, "gauge_length_mm": -5}),
        body([], specimen={"diameter_mm": 10}),
        body([], schema_version=2),
        body([], preset=""),
        {"preset": "steel_textbook", "history": []},  # no specimen
        body([{"op": "strain", "to": 0.1}] * 501),  # history too long
    ],
)
def test_invalid_requests_are_rejected_with_invalid_input(
    client: TestClient, request_body: dict[str, Any]
) -> None:
    response = client.post(URL, json=request_body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_not_a_number_strain_is_rejected(client: TestClient) -> None:
    raw = (
        '{"preset":"steel_textbook","specimen":{"diameter_mm":10,"gauge_length_mm":50},'
        '"history":[{"op":"strain","to":NaN}]}'
    )
    response = client.post(URL, content=raw, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_the_longest_allowed_history_works(client: TestClient) -> None:
    history = [{"op": "strain", "to": 0.001 * (i % 2)} for i in range(500)]
    assert client.post(URL, json=body(history)).status_code == 200


def test_beam_analysis_is_untouched(client: TestClient) -> None:
    beam = {
        "length": 6,
        "supports": [
            {"id": "a", "type": "pin", "position": 0},
            {"id": "b", "type": "roller", "position": 6},
        ],
        "loads": [{"id": "p", "type": "point", "position": 3, "magnitude": -10}],
    }
    assert client.post("/api/v1/analyze", json=beam).status_code == 200


def test_every_trace_point_is_a_full_state(client: TestClient) -> None:
    out = client.post(URL, json=body([{"op": "strain", "to": 0.25}])).json()
    trace = out["trace"]
    assert trace[-1]["region"] == "fractured"
    assert trace[-1]["plastic_strain"] == pytest.approx(0.2485)
    assert trace[-2]["region"] == "necking"
    peak = next(t for t in trace if t["strain"] == pytest.approx(0.15))
    assert peak["stress_mpa"] == pytest.approx(400.0)
    assert peak["plastic_strain"] == pytest.approx(0.148)
    assert peak["region"] == "strain_hardening"
    plateau = next(t for t in trace if t["strain"] == pytest.approx(0.015))
    assert plateau["region"] == "yield_plateau"
    assert all(0.0 <= t["plastic_strain"] <= t["strain"] + 1e-9 for t in trace)


def test_unloading_points_are_labelled_unloading_with_the_permanent_strain(
    client: TestClient,
) -> None:
    out = client.post(
        URL, json=body([{"op": "strain", "to": 0.05}, {"op": "unload_to_zero_stress"}])
    ).json()
    last = out["trace"][-1]
    assert last["region"] == "unloading"
    assert last["stress_mpa"] == 0.0
    assert last["plastic_strain"] == pytest.approx(last["strain"])
