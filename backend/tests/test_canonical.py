"""Tests for the textbook canonical formula matcher and derivations."""

import json
from pathlib import Path

import pytest

from beam_solver.analysis import analyze
from beam_solver.domain import Beam, PointLoad, Support, SupportKind
from beam_solver.io import beam_from_json

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def load_fixture(name: str) -> Beam:
    data = json.loads((FIXTURES_DIR / name).read_text())
    return beam_from_json(data["input"])


def test_canonical_ss_midspan_point() -> None:
    beam = load_fixture("01_ss_central_point.json")
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "ss_midspan_point"
    assert "PL/4" in c.symbolic_formula or r"\frac{PL}{4}" in c.symbolic_formula
    assert "15" in c.result_text
    assert len(c.derivation) >= 4


def test_canonical_ss_full_udl() -> None:
    beam = load_fixture("02_ss_full_udl.json")
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "ss_full_udl"
    assert r"\frac{wL^2}{8}" in c.symbolic_formula
    assert "9" in c.result_text
    assert len(c.derivation) >= 4


def test_canonical_cantilever_full_udl() -> None:
    beam = load_fixture("03_cantilever_left_udl.json")
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "cantilever_full_udl"
    assert r"\frac{wL^2}{2}" in c.symbolic_formula
    assert "-24" in c.result_text


def test_canonical_cantilever_end_point() -> None:
    beam = load_fixture("04_cantilever_right_point.json")
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "cantilever_end_point"
    assert "-PL" in c.symbolic_formula
    assert "-20" in c.result_text


def test_canonical_ss_triangular() -> None:
    beam = load_fixture("07_ss_triangular.json")
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "ss_triangular"
    assert r"9\sqrt{3}" in c.symbolic_formula
    assert "6.928" in c.result_text


def test_canonical_ss_point_ab() -> None:
    # Off-center point load at a = 2, L = 6, b = 4, P = -12
    # Expected M_max = (12 * 2 * 4) / 6 = 16 kNm
    beam = Beam(
        length=6.0,
        supports=(
            Support("s1", SupportKind.PIN, 0.0),
            Support("s2", SupportKind.ROLLER, 6.0),
        ),
        loads=(PointLoad("p1", 2.0, -12.0),),
    )
    result = analyze(beam)

    assert result.canonical is not None
    c = result.canonical
    assert c.case_id == "ss_point_ab"
    assert r"\frac{Pab}{L}" in c.symbolic_formula
    assert "16" in c.result_text
    assert "2" in c.location_text


@pytest.mark.parametrize(
    "fixture_name",
    [
        "05_overhang_point.json",
        "06_ss_clockwise_couple.json",
        "08_ss_partial_udl.json",
        "09_load_on_support.json",
        "10_cantilever_couple_free_end.json",
        "11_no_loads.json",
    ],
)
def test_non_canonical_fallbacks(fixture_name: str) -> None:
    beam = load_fixture(fixture_name)
    result = analyze(beam)
    # Non-canonical setups must smoothly return None without crashing
    assert result.canonical is None
