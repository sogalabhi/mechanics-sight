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
    hinges: tuple[float, ...] = ()

    def __post_init__(self) -> None:
        if not math.isfinite(self.length) or self.length <= 0:
            raise InvalidBeamError(f"length must be a finite number > 0, got {self.length}")
        if not self.supports:
            raise InvalidSupportError("the beam needs at least one support")
        object.__setattr__(self, "hinges", tuple(sorted(self.hinges)))
        self._check_ids()
        self._check_supports()
        self._check_loads()
        self._check_hinges()

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
            if isinstance(load, PointLoad):
                if not math.isfinite(load.magnitude) or not math.isfinite(load.fx):
                    raise InvalidLoadError(f"{owner}: magnitude and fx must be finite")
                self._check_position(owner, load.position)
            elif isinstance(load, PointMoment):
                if not math.isfinite(load.magnitude):
                    raise InvalidLoadError(f"{owner}: magnitude must be finite")
                self._check_position(owner, load.position)
            elif isinstance(load, DistributedLoad):
                self._check_position(owner, load.start)
                self._check_position(owner, load.end)

    def _check_hinges(self) -> None:
        for x in self.hinges:
            if not math.isfinite(x):
                raise InvalidPositionError(f"hinge: position must be finite, got {x}")
            for s in self.supports:
                if s.kind is SupportKind.FIXED and same_position(s.position, x):
                    raise InvalidBeamError(f"cannot place a hinge at fixed support {s.id!r}")
            if x <= POSITION_TOL or x >= self.length - POSITION_TOL:
                raise InvalidPositionError(
                    f"hinge: position {x} must be strictly inside (0, {self.length})"
                )
            for load in self.loads:
                if isinstance(load, PointMoment) and same_position(load.position, x):
                    raise InvalidLoadError(
                        "cannot place an applied moment couple directly at an internal hinge "
                        f"at x = {x}"
                    )
        for i, a in enumerate(self.hinges):
            for b in self.hinges[i + 1 :]:
                if same_position(a, b):
                    raise InvalidBeamError(f"duplicate hinges at position {a}")
