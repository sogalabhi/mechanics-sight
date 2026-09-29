"""Cross-check against SymPy's Beam (plan.md Section 8.5).

Sign mapping, established on case 1: SymPy's ``apply_load(value, ...)`` takes loads
with the *opposite* sign to ours (downward positive), and reactions from
``solve_for_reaction_loads`` follow that sign, so they are flipped too. Its
``bending_moment()`` has the *same* sign as our sagging-positive M.
"""

import pytest

sympy = pytest.importorskip("sympy")
from sympy.physics.continuum_mechanics.beam import Beam as SymBeam  # noqa: E402

from beam_solver.analysis import Side, analyze  # noqa: E402
from beam_solver.domain import (  # noqa: E402
    Beam,
    DistributedLoad,
    PointLoad,
    Support,
    SupportKind,
)


def sympy_beam(length: float) -> tuple[SymBeam, sympy.Symbol, sympy.Symbol]:
    e, i = sympy.symbols("E I")
    b = SymBeam(length, e, i)
    r1, r2 = sympy.symbols("R1 R2")
    b.apply_load(r1, 0, -1)
    b.apply_load(r2, length, -1)
    return b, r1, r2


def test_mapping_case_1() -> None:
    b, r1, r2 = sympy_beam(6)
    b.apply_load(10, 3, -1)  # 10 kN downward = our -10
    b.solve_for_reaction_loads(r1, r2)
    ours = analyze(
        Beam(
            6.0,
            (Support("a", SupportKind.PIN, 0), Support("b", SupportKind.ROLLER, 6)),
            (PointLoad("p", 3.0, -10.0),),
        )
    )
    assert float(b.reaction_loads[r1]) == pytest.approx(-ours.reactions[0].fy)
    x = sympy.Symbol("x")
    assert float(b.bending_moment().subs(x, 3)) == pytest.approx(
        ours.moment_at(3.0, side=Side.LEFT)
    )


@pytest.mark.parametrize("xs", [[1.0, 2.5, 4.0, 5.5]])
def test_partial_trapezoid(xs: list[float]) -> None:
    b, r1, r2 = sympy_beam(6)
    # Trapezoid 2 -> 5 kN/m downward over 1..4, as UDL + ramp in singularity functions.
    b.apply_load(2, 1, 0, end=4)
    b.apply_load(1, 1, 1, end=4)
    b.solve_for_reaction_loads(r1, r2)
    ours = analyze(
        Beam(
            6.0,
            (Support("a", SupportKind.PIN, 0), Support("b", SupportKind.ROLLER, 6)),
            (DistributedLoad("d", 1.0, 4.0, -2.0, -5.0),),
        )
    )
    x = sympy.Symbol("x")
    assert float(b.reaction_loads[r1]) == pytest.approx(-ours.reactions[0].fy)
    for xv in xs:
        assert float(b.bending_moment().subs(x, xv)) == pytest.approx(
            ours.moment_at(xv, side=Side.LEFT)
        )
