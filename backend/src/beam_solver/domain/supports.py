"""Supports and the directions they restrain."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from enum import Enum

from beam_solver.errors import InvalidSupportError


class Direction(Enum):
    """A direction a support can restrain."""

    X = "x"
    Y = "y"
    ROTATION = "rotation"


class SupportKind(Enum):
    """Support types."""

    PIN = "pin"
    ROLLER = "roller"
    FIXED = "fixed"


RESTRAINTS: Mapping[SupportKind, tuple[Direction, ...]] = {
    SupportKind.ROLLER: (Direction.Y,),
    SupportKind.PIN: (Direction.X, Direction.Y),
    SupportKind.FIXED: (Direction.X, Direction.Y, Direction.ROTATION),
}


@dataclass(frozen=True)
class Support:
    """A support at ``position`` (m from the left end).

    settlement: vertical displacement (m, downward positive).
    spring_ky: elastic vertical spring stiffness (kN/m).
    spring_ktheta: elastic rotational spring stiffness (kN·m/rad).
    """

    id: str
    kind: SupportKind
    position: float
    settlement: float = 0.0
    spring_ky: float | None = None
    spring_ktheta: float | None = None

    def __post_init__(self) -> None:
        if not math.isfinite(self.settlement):
            raise InvalidSupportError(f"support {self.id!r}: settlement must be finite")
        if self.spring_ky is not None and (
            not math.isfinite(self.spring_ky) or self.spring_ky <= 0
        ):
            raise InvalidSupportError(f"support {self.id!r}: spring_ky must be > 0")
        if self.spring_ktheta is not None and (
            not math.isfinite(self.spring_ktheta) or self.spring_ktheta <= 0
        ):
            raise InvalidSupportError(f"support {self.id!r}: spring_ktheta must be > 0")

    @property
    def restraints(self) -> tuple[Direction, ...]:
        """Restrained directions; each one produces an unknown reaction."""
        return RESTRAINTS[self.kind]
