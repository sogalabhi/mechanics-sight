"""The beam: length, supports and loads, validated on creation."""

import math
from dataclasses import dataclass

from beam_solver.domain.loads import DistributedLoad, Load, PointLoad, PointMoment
from beam_solver.domain.supports import Support, SupportKind
from beam_solver.errors import (
    InvalidBeamError,
    InvalidLoadError,
    InvalidPositionError,
    InvalidSupportError,
)
from beam_solver.tolerances import POSITION_TOL, same_position


@dataclass(frozen=True)
class Beam:
    """A straight beam of ``length`` (m). Positions are measured from the left end."""

    length: float
    supports: tuple[Support, ...]
    loads: tuple[Load, ...] = ()

    def __post_init__(self) -> None:
        if not math.isfinite(self.length) or self.length <= 0:
            raise InvalidBeamError(f"length must be a finite number > 0, got {self.length}")
        if not self.supports:
            raise InvalidSupportError("the beam needs at least one support")
        self._check_ids()
        self._check_supports()
        self._check_loads()

    def _check_ids(self) -> None:
        ids = [s.id for s in self.supports] + [load.id for load in self.loads]
        duplicates = sorted({i for i in ids if ids.count(i) > 1})
        if duplicates:
            raise InvalidBeamError(f"duplicate ids: {', '.join(duplicates)}")

    def _check_position(self, owner: str, x: float) -> None:
        if not math.isfinite(x):
            raise InvalidPositionError(f"{owner}: position must be finite")
        if x < -POSITION_TOL or x > self.length + POSITION_TOL:
            raise InvalidPositionError(f"{owner}: position {x} is outside [0, {self.length}]")

    def _check_supports(self) -> None:
        for support in self.supports:
            self._check_position(f"support {support.id!r}", support.position)
            at_end = same_position(support.position, 0.0) or same_position(
                support.position, self.length
            )
            if support.kind is SupportKind.FIXED and not at_end:
                raise InvalidSupportError(
                    f"support {support.id!r}: a fixed support must be at x = 0 or x = L"
                )
        for i, a in enumerate(self.supports):
            for b in self.supports[i + 1 :]:
                if same_position(a.position, b.position):
                    raise InvalidSupportError(
                        f"supports {a.id!r} and {b.id!r} are at the same position"
                    )

    def _check_loads(self) -> None:
        for load in self.loads:
            owner = f"load {load.id!r}"
            if isinstance(load, PointLoad | PointMoment):
                if not math.isfinite(load.magnitude):
                    raise InvalidLoadError(f"{owner}: magnitude must be finite")
                self._check_position(owner, load.position)
            elif isinstance(load, DistributedLoad):
                self._check_position(owner, load.start)
                self._check_position(owner, load.end)
