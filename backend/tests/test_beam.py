"""Beam validation (plan.md Section 5)."""

import math

import pytest

from beam_solver.domain import (
    Beam,
    Direction,
    DistributedLoad,
    PointLoad,
    PointMoment,
    Support,
    SupportKind,
)
from beam_solver.errors import (
    InvalidBeamError,
    InvalidLoadError,
    InvalidPositionError,
    InvalidSupportError,
)

PIN = SupportKind.PIN
ROLLER = SupportKind.ROLLER
FIXED = SupportKind.FIXED


def ss(length: float = 6.0) -> tuple[Support, ...]:
    return (Support("s1", PIN, 0.0), Support("s2", ROLLER, length))


def test_valid_beam() -> None:
    beam = Beam(6.0, ss(), (PointLoad("p", 3.0, -10.0), DistributedLoad("d", 0, 6, -1, -1)))
    assert len(beam.loads) == 2


def test_restraints() -> None:
    assert Support("a", ROLLER, 0).restraints == (Direction.Y,)
    assert Support("a", PIN, 0).restraints == (Direction.X, Direction.Y)
    assert len(Support("a", FIXED, 0).restraints) == 3


def test_no_loads_is_fine() -> None:
    assert Beam(5.0, ss(5.0)).loads == ()


def test_position_within_tolerance_of_end_is_accepted() -> None:
    Beam(6.0, ss(), (PointLoad("p", 6.0 + 1e-9, -1.0),))


@pytest.mark.parametrize("length", [0.0, -1.0, math.nan, math.inf])
def test_bad_length(length: float) -> None:
    with pytest.raises(InvalidBeamError):
        Beam(length, (Support("s", FIXED, 0.0),))


def test_no_supports() -> None:
    with pytest.raises(InvalidSupportError):
        Beam(6.0, ())


def test_duplicate_ids() -> None:
    with pytest.raises(InvalidBeamError, match="s1"):
        Beam(6.0, ss(), (PointLoad("s1", 1.0, 1.0),))


def test_supports_at_same_position() -> None:
    with pytest.raises(InvalidSupportError):
        Beam(6.0, (Support("a", PIN, 3.0), Support("b", ROLLER, 3.0)))


def test_fixed_in_the_middle() -> None:
    with pytest.raises(InvalidSupportError):
        Beam(6.0, (Support("a", FIXED, 2.0),))


def test_fixed_at_right_end() -> None:
    Beam(6.0, (Support("a", FIXED, 6.0),))


@pytest.mark.parametrize(
    "load",
    [
        PointLoad("p", 7.0, -1.0),
        PointMoment("c", -0.5, 1.0),
        DistributedLoad("d", 5.0, 6.5, -1.0, -1.0),
    ],
)
def test_load_outside_beam(load: PointLoad | PointMoment | DistributedLoad) -> None:
    with pytest.raises(InvalidPositionError):
        Beam(6.0, ss(), (load,))


def test_support_outside_beam() -> None:
    with pytest.raises(InvalidPositionError):
        Beam(6.0, (Support("a", PIN, 0.0), Support("b", ROLLER, 6.5)))


def test_nan_magnitude() -> None:
    with pytest.raises(InvalidLoadError):
        Beam(6.0, ss(), (PointLoad("p", 1.0, math.nan),))


def test_beam_is_immutable() -> None:
    beam = Beam(6.0, ss())
    with pytest.raises(AttributeError):
        beam.length = 3.0  # type: ignore[misc]
