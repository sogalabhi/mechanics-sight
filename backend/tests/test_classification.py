"""Classification table (plan.md Section 6.7, Phase 1 rows)."""

import pytest

from beam_solver.domain import Beam, Support, SupportKind
from beam_solver.solvers import Determinacy, EquilibriumSystem, classify

PIN, ROLLER, FIXED = SupportKind.PIN, SupportKind.ROLLER, SupportKind.FIXED
UNST, DET, IND = Determinacy.UNSTABLE, Determinacy.DETERMINATE, Determinacy.INDETERMINATE


@pytest.mark.parametrize(
    ("supports", "r", "status", "axial", "bending"),
    [
        ([(ROLLER, 0)], 1, UNST, 0, 0),
        ([(ROLLER, 0), (ROLLER, 6)], 2, UNST, 0, 0),
        ([(PIN, 0)], 2, UNST, 0, 0),
        ([(ROLLER, 0), (ROLLER, 3), (ROLLER, 6)], 3, UNST, 0, 0),
        ([(PIN, 0), (ROLLER, 6)], 3, DET, 0, 0),
        ([(FIXED, 0)], 3, DET, 0, 0),
        ([(PIN, 0), (PIN, 6)], 4, IND, 1, 0),
        ([(FIXED, 0), (ROLLER, 6)], 4, IND, 0, 1),
        ([(PIN, 0), (ROLLER, 3), (ROLLER, 6)], 4, IND, 0, 1),
        ([(FIXED, 0), (PIN, 6)], 5, IND, 1, 1),
        ([(FIXED, 0), (FIXED, 6)], 6, IND, 1, 2),
    ],
)
def test_classification_table(
    supports: list[tuple[SupportKind, float]],
    r: int,
    status: Determinacy,
    axial: int,
    bending: int,
) -> None:
    beam = Beam(6.0, tuple(Support(f"s{i}", k, x) for i, (k, x) in enumerate(supports)))
    c = classify(EquilibriumSystem.from_beam(beam))
    assert (c.restraints, c.equations, c.status) == (r, 3, status)
    if status is Determinacy.UNSTABLE:
        assert c.reason
    else:
        assert (c.axial_degree, c.bending_degree) == (axial, bending)
        assert c.degree == r - 3


def test_three_rollers_reason_mentions_horizontal() -> None:
    beam = Beam(6.0, tuple(Support(f"s{i}", ROLLER, x) for i, x in enumerate((0, 3, 6))))
    assert "horizontal" in (classify(EquilibriumSystem.from_beam(beam)).reason or "")
