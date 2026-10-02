"""Tests for the Multi-Method Pedagogical Engine (Milestones 4.2 & 4.3)."""

import pytest
from fastapi.testclient import TestClient

from beam_solver.analysis import analyze, build_steps
from beam_solver.analysis.methods.router import available_methods, default_method_for
from beam_solver.api.app import create_app
from beam_solver.domain import Beam, DistributedLoad, PointLoad, Support, SupportKind


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_available_methods_propped_cantilever():
    beam = Beam(
        6.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (DistributedLoad("w", 0.0, 6.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    methods = available_methods(beam, res)
    assert "force_method" in methods
    assert "direct_stiffness" in methods
    assert "slope_deflection" in methods
    assert "moment_distribution" in methods
    assert default_method_for(beam, res) == "force_method"


def test_available_methods_continuous_beam():
    beam = Beam(
        12.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 6.0),
            Support("C", SupportKind.ROLLER, 12.0),
        ),
        (DistributedLoad("w", 0.0, 12.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    methods = available_methods(beam, res)
    assert "three_moment" in methods
    assert "moment_distribution" in methods
    assert "slope_deflection" in methods
    assert "force_method" in methods
    assert "direct_stiffness" in methods
    assert default_method_for(beam, res) == "three_moment"


def test_force_method_steps():
    beam = Beam(
        6.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (DistributedLoad("w", 0.0, 6.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    steps = build_steps(beam, res, method="force_method")
    titles = [s.title for s in steps]
    assert any("Force Method: Degree of Indeterminacy" in t for t in titles)
    assert any("Select Primary Determinate Structure" in t for t in titles)
    assert any("Flexibility Coefficient" in t for t in titles)
    assert any("Compatibility Equation" in t for t in titles)


def test_slope_deflection_steps():
    beam = Beam(
        8.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.FIXED, 8.0)),
        (PointLoad("P", 4.0, -20.0),),
    )
    res = analyze(beam)
    steps = build_steps(beam, res, method="slope_deflection")
    titles = [s.title for s in steps]
    assert any("Slope-Deflection Method" in t for t in titles)
    assert any("Fixed-End Moments" in t for t in titles)
    assert any("Rotational Boundary Conditions" in t for t in titles)


def test_moment_distribution_steps():
    beam = Beam(
        12.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 6.0),
            Support("C", SupportKind.ROLLER, 12.0),
        ),
        (DistributedLoad("w", 0.0, 12.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    steps = build_steps(beam, res, method="moment_distribution")
    titles = [s.title for s in steps]
    assert any("Moment Distribution Method" in t for t in titles)
    assert any("Stiffness & Distribution Factors" in t for t in titles)
    assert any("Distribution Cycles" in t for t in titles)


def test_three_moment_steps():
    beam = Beam(
        12.0,
        (
            Support("A", SupportKind.PIN, 0.0),
            Support("B", SupportKind.ROLLER, 6.0),
            Support("C", SupportKind.ROLLER, 12.0),
        ),
        (DistributedLoad("w", 0.0, 12.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    steps = build_steps(beam, res, method="three_moment")
    titles = [s.title for s in steps]
    assert any("Theorem of Three Moments" in t for t in titles)
    assert any("Three-Moment Equation for Joint" in t for t in titles)


def test_direct_stiffness_steps():
    beam = Beam(
        6.0,
        (Support("A", SupportKind.FIXED, 0.0), Support("B", SupportKind.ROLLER, 6.0)),
        (DistributedLoad("w", 0.0, 6.0, -10.0, -10.0),),
    )
    res = analyze(beam)
    steps = build_steps(beam, res, method="direct_stiffness")
    titles = [s.title for s in steps]
    assert any("Direct Stiffness Method" in t for t in titles)
    assert any("Work-Equivalent Nodal Loads" in t for t in titles)
    assert any("Global Assembly & Partitioned Matrix Solution" in t for t in titles)


def test_api_method_query_param(client: TestClient):
    body = {
        "length": 6.0,
        "supports": [
            {"id": "a", "type": "fixed", "position": 0.0},
            {"id": "b", "type": "roller", "position": 6.0},
        ],
        "loads": [
            {
                "id": "w",
                "type": "distributed",
                "start": 0.0,
                "end": 6.0,
                "w_start": -10.0,
                "w_end": -10.0,
            }
        ],
    }
    # Request without method: defaults to recommended
    r1 = client.post("/api/v1/analyze?steps=true", json=body)
    assert r1.status_code == 200
    data1 = r1.json()
    assert "force_method" in data1["available_methods"]
    assert data1["selected_method"] == "force_method"
    assert any("Force Method" in s["title"] for s in data1["steps"])

    # Request with method=direct_stiffness
    r2 = client.post("/api/v1/analyze?steps=true&method=direct_stiffness", json=body)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["selected_method"] == "direct_stiffness"
    assert any("Direct Stiffness Method" in s["title"] for s in data2["steps"])
