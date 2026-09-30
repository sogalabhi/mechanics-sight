"""Loads. Signs: forces and w upward positive, moments anticlockwise positive (kN, m)."""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass

from numpy.polynomial import Polynomial

from beam_solver.errors import InvalidLoadError
from beam_solver.tolerances import POSITION_TOL

_ZERO = Polynomial([0.0])


class Load(ABC):
    """Common interface for every load type."""

    id: str

    @abstractmethod
    def resultant(self) -> float:
        """Total vertical force, upward positive (kN)."""

    @abstractmethod
    def horizontal_resultant(self) -> float:
        """Total horizontal force, rightward positive (kN)."""

    @abstractmethod
    def moment_about(self, x0: float) -> float:
        """Moment about ``x0``, anticlockwise positive (kN·m)."""

    @abstractmethod
    def breakpoints(self) -> tuple[float, ...]:
        """Positions where this load starts, ends or acts (m)."""

    @abstractmethod
    def section_polynomials(self, x0: float) -> tuple[Polynomial, Polynomial]:
        """Contribution to V (kN) and M (kN·m) on a segment starting at ``x0``.

        Polynomials are in the local coordinate t = x - x0. Valid only when no
        breakpoint of this load lies strictly inside the segment.
        """

    @abstractmethod
    def axial_polynomial(self, x0: float) -> Polynomial:
        """Contribution to N (kN, tension positive) on a segment starting at ``x0``."""

    @abstractmethod
    def split(self, x: float) -> tuple[Load | None, Load | None]:
        """Parts of this load left and right of ``x``. A point load at ``x`` goes left."""


def _is_left(a: float, x: float) -> bool:
    return a <= x + POSITION_TOL


@dataclass(frozen=True)
class PointLoad(Load):
    """Point load at ``position`` (m), with vertical and horizontal components (kN).

    ``magnitude`` is upward positive; ``fx`` is rightward positive.
    """

    id: str
    position: float
    magnitude: float
    fx: float = 0.0

    def resultant(self) -> float:
        return self.magnitude

    def horizontal_resultant(self) -> float:
        return self.fx

    def moment_about(self, x0: float) -> float:
        return self.magnitude * (self.position - x0)

    def breakpoints(self) -> tuple[float, ...]:
        return (self.position,)

    def section_polynomials(self, x0: float) -> tuple[Polynomial, Polynomial]:
        if not _is_left(self.position, x0):
            return _ZERO, _ZERO
        f = self.magnitude
        return Polynomial([f]), Polynomial([f * (x0 - self.position), f])

    def axial_polynomial(self, x0: float) -> Polynomial:
        if not _is_left(self.position, x0):
            return _ZERO
        return Polynomial([-self.fx])

    def split(self, x: float) -> tuple[Load | None, Load | None]:
        return (self, None) if _is_left(self.position, x) else (None, self)


@dataclass(frozen=True)
class PointMoment(Load):
    """Applied couple ``magnitude`` (kN·m, anticlockwise positive) at ``position`` (m)."""

    id: str
    position: float
    magnitude: float

    def resultant(self) -> float:
        return 0.0

    def horizontal_resultant(self) -> float:
        return 0.0

    def moment_about(self, x0: float) -> float:
        return self.magnitude

    def breakpoints(self) -> tuple[float, ...]:
        return (self.position,)

    def section_polynomials(self, x0: float) -> tuple[Polynomial, Polynomial]:
        if not _is_left(self.position, x0):
            return _ZERO, _ZERO
        return _ZERO, Polynomial([-self.magnitude])

    def axial_polynomial(self, x0: float) -> Polynomial:
        return _ZERO

    def split(self, x: float) -> tuple[Load | None, Load | None]:
        return (self, None) if _is_left(self.position, x) else (None, self)


@dataclass(frozen=True)
class DistributedLoad(Load):
    """Linearly varying load from ``start`` to ``end`` (m), intensities in kN/m.

    Covers UDL (w_start == w_end), triangular and trapezoidal loads.
    """

    id: str
    start: float
    end: float
    w_start: float
    w_end: float

    def __post_init__(self) -> None:
        values = (self.start, self.end, self.w_start, self.w_end)
        if not all(math.isfinite(v) for v in values):
            raise InvalidLoadError(f"load {self.id!r}: values must be finite")
        if self.end - self.start <= POSITION_TOL:
            raise InvalidLoadError(f"load {self.id!r}: end must be greater than start")
        if self.w_start * self.w_end < 0:
            raise InvalidLoadError(
                f"load {self.id!r}: w_start and w_end must not have opposite signs"
            )

    @property
    def length(self) -> float:
        return self.end - self.start

    def intensity_at(self, x: float) -> float:
        """Intensity w (kN/m) at ``x`` inside the load."""
        return self.w_start + (self.w_end - self.w_start) * (x - self.start) / self.length

    def _pieces(self) -> tuple[tuple[float, float], tuple[float, float]]:
        """(force, position) of the rectangle and triangle parts."""
        length = self.length
        rectangle = (self.w_start * length, self.start + length / 2)
        triangle = ((self.w_end - self.w_start) * length / 2, self.start + 2 * length / 3)
        return rectangle, triangle

    def resultant(self) -> float:
        return (self.w_start + self.w_end) * self.length / 2

    def horizontal_resultant(self) -> float:
        return 0.0

    def moment_about(self, x0: float) -> float:
        return sum(force * (pos - x0) for force, pos in self._pieces())

    def breakpoints(self) -> tuple[float, ...]:
        return (self.start, self.end)

    def section_polynomials(self, x0: float) -> tuple[Polynomial, Polynomial]:
        if _is_left(self.end, x0):
            total = self.resultant()
            return Polynomial([total]), Polynomial([-self.moment_about(x0), total])
        if not _is_left(self.start, x0):
            return _ZERO, _ZERO
        k = (self.w_end - self.w_start) / self.length
        w1 = self.w_start
        shift = Polynomial([x0 - self.start, 1.0])
        shear = Polynomial([0.0, w1, k / 2])(shift)
        moment = Polynomial([0.0, 0.0, w1 / 2, k / 6])(shift)
        return shear, moment

    def axial_polynomial(self, x0: float) -> Polynomial:
        return _ZERO

    def split(self, x: float) -> tuple[Load | None, Load | None]:
        if x <= self.start + POSITION_TOL:
            return None, self
        if x >= self.end - POSITION_TOL:
            return self, None
        w = self.intensity_at(x)
        left = DistributedLoad(self.id, self.start, x, self.w_start, w)
        right = DistributedLoad(self.id, x, self.end, w, self.w_end)
        return left, right
