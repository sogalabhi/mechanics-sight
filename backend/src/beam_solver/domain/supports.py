"""Supports and the directions they restrain."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import Enum


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
    """A support at ``position`` (m from the left end)."""

    id: str
    kind: SupportKind
    position: float

    @property
    def restraints(self) -> tuple[Direction, ...]:
        """Restrained directions; each one produces an unknown reaction."""
        return RESTRAINTS[self.kind]
