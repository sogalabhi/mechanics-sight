"""Result dataclasses (plan.md Section 7.5). Units: m, kN, kN·m."""

from dataclasses import dataclass
from enum import Enum

import numpy as np
from numpy.polynomial import Polynomial

from beam_solver.solvers import Classification, Reaction
from beam_solver.tolerances import same_position


class Side(Enum):
    """Which side of a point to read at a jump."""

    LEFT = "left"
    RIGHT = "right"


@dataclass(frozen=True)
class Segment:
    """N, V and M between two critical points, as ascending coefficients in t = x - x_start."""

    x_start: float
    x_end: float
    shear: tuple[float, ...]
    moment: tuple[float, ...]
    axial: tuple[float, ...] = (0.0,)

    @property
    def length(self) -> float:
        return self.x_end - self.x_start

    def shear_poly(self) -> Polynomial:
        return Polynomial(self.shear)

    def moment_poly(self) -> Polynomial:
        return Polynomial(self.moment)

    def axial_poly(self) -> Polynomial:
        return Polynomial(self.axial)


@dataclass(frozen=True)
class CriticalPoint:
    """Exact values just left and just right of a critical point."""

    x: float
    shear_left: float
    shear_right: float
    moment_left: float
    moment_right: float
    axial_left: float = 0.0
    axial_right: float = 0.0


@dataclass(frozen=True)
class Extreme:
    x: float
    value: float


@dataclass(frozen=True)
class SampledDiagram:
    """Points for plotting; a jump appears as two samples at the same x."""

    x: tuple[float, ...]
    shear: tuple[float, ...]
    moment: tuple[float, ...]
    axial: tuple[float, ...] = ()


@dataclass(frozen=True)
class CanonicalCase:
    """A recognized standard textbook case with symbolic and substituted formulas."""

    case_id: str
    name: str
    symbolic_formula: str
    symbolic_reactions: str
    substituted_formula: str
    result_text: str
    location_text: str
    derivation: tuple[str, ...]


@dataclass(frozen=True)
class AnalysisResult:
    classification: Classification
    reactions: tuple[Reaction, ...]
    segments: tuple[Segment, ...]
    critical_points: tuple[CriticalPoint, ...]
    zero_shear_points: tuple[float, ...]
    max_sagging: Extreme | None
    max_hogging: Extreme | None
    max_positive_shear: Extreme | None
    max_negative_shear: Extreme | None
    warnings: tuple[str, ...]
    canonical: CanonicalCase | None = None
    max_tension: Extreme | None = None
    max_compression: Extreme | None = None

    def _critical_point(self, x: float) -> CriticalPoint | None:
        return next((cp for cp in self.critical_points if same_position(cp.x, x)), None)

    def _segment(self, x: float) -> Segment:
        for segment in self.segments:
            if segment.x_start < x < segment.x_end:
                return segment
        raise ValueError(f"x = {x} is outside the beam")

    def shear_at(self, x: float, *, side: Side) -> float:
        """Shear V (kN) at ``x``; ``side`` matters only at a jump."""
        cp = self._critical_point(x)
        if cp is not None:
            return cp.shear_left if side is Side.LEFT else cp.shear_right
        segment = self._segment(x)
        return float(segment.shear_poly()(x - segment.x_start))

    def moment_at(self, x: float, *, side: Side) -> float:
        """Bending moment M (kN·m, sagging positive) at ``x``."""
        cp = self._critical_point(x)
        if cp is not None:
            return cp.moment_left if side is Side.LEFT else cp.moment_right
        segment = self._segment(x)
        return float(segment.moment_poly()(x - segment.x_start))

    def axial_at(self, x: float, *, side: Side) -> float:
        """Axial force N (kN, tension positive) at ``x``, with exact jump values."""
        cp = self._critical_point(x)
        if cp is not None:
            return cp.axial_left if side is Side.LEFT else cp.axial_right
        segment = self._segment(x)
        return float(segment.axial_poly()(x - segment.x_start))

    def sample(self, points_per_segment: int = 100) -> SampledDiagram:
        """Sample every segment, always including its exact ends."""
        xs: list[float] = []
        vs: list[float] = []
        ms: list[float] = []
        ns: list[float] = []
        for segment in self.segments:
            t = np.linspace(0.0, segment.length, points_per_segment)
            xs.extend((segment.x_start + t).tolist())
            vs.extend(segment.shear_poly()(t).tolist())
            ms.extend(segment.moment_poly()(t).tolist())
            ns.extend(segment.axial_poly()(t).tolist())
        return SampledDiagram(tuple(xs), tuple(vs), tuple(ms), tuple(ns))
