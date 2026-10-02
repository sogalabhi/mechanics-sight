"""Worked steps must build for every fixture beam with every method offered for it.

Regression: a `{bmatrix}` inside an f-string was read as a variable, so the Force Method steps of
the fixed-fixed beams raised NameError and the API answered 500.
"""

from typing import Any

import pytest
from conftest import beam_from_fixture, load_fixtures

from beam_solver.analysis import analyze, build_steps
from beam_solver.analysis.methods.router import available_methods

CASES = [
    (fixture["name"], method)
    for fixture in load_fixtures()
    for method in available_methods(
        beam_from_fixture(fixture["input"]), analyze(beam_from_fixture(fixture["input"]))
    )
]
FIXTURES = {f["name"]: f for f in load_fixtures()}


def latex_fields(step: Any) -> list[str]:
    return [t for t in (step.symbolic, step.substituted, step.result) if t]


def balanced(tex: str) -> bool:
    depth = 0
    for ch in tex.replace("\\{", "").replace("\\}", ""):
        depth += ch == "{"
        depth -= ch == "}"
        if depth < 0:
            return False
    return depth == 0


def test_there_are_indeterminate_fixtures_to_check() -> None:
    methods = {m for _, m in CASES}
    assert {
        "force_method",
        "direct_stiffness",
        "slope_deflection",
        "moment_distribution",
    } <= methods
    assert any(name.startswith("18_") for name, _ in CASES)


@pytest.mark.parametrize(("name", "method"), CASES, ids=[f"{n}-{m}" for n, m in CASES])
def test_steps_build_and_latex_is_well_formed(name: str, method: str) -> None:
    beam = beam_from_fixture(FIXTURES[name]["input"])
    steps = build_steps(beam, analyze(beam), method=method)
    assert steps
    for step in steps:
        for tex in latex_fields(step):
            assert balanced(tex), f"{name} {method} {step.title}: unbalanced braces in {tex!r}"


def test_force_method_for_a_fixed_fixed_beam_shows_the_flexibility_matrix() -> None:
    """Two redundants: the steps show the 2x2 flexibility matrix EI*[f] (L^3/3, L^2/2, L)."""
    beam = beam_from_fixture(FIXTURES["18_fixed_fixed_udl"]["input"])  # L = 6 m
    steps = build_steps(beam, analyze(beam), method="force_method")
    matrix = next(s for s in steps if s.title.startswith("Flexibility Matrix"))
    assert matrix.result is not None
    assert (
        r"\begin{bmatrix} 72 & 18 \\ 18 & 6 \end{bmatrix}" in matrix.result
    )  # 216/3, 36/2, 36/2, 6
    solution = next(s for s in steps if s.title.startswith("Compatibility Equations"))
    assert solution.result is not None
    assert "R_{B} = 30" in solution.result  # wL/2
