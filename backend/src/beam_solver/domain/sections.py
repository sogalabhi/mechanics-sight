"""Material and cross-section geometry for physical deflection and stress analysis.

Section dimensions are metres. The local y-axis passes through the centroid and is
positive upward. Area is m², second moment of area is m⁴, and Q is m³.
"""

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass

from beam_solver.errors import InvalidSectionError


def _positive(owner: str, **values: float) -> None:
    for name, value in values.items():
        if not math.isfinite(value) or value <= 0.0:
            raise InvalidSectionError(f"{owner}: {name} must be finite and greater than zero")


def _rectangle_q(width: float, bottom: float, top: float, cut: float) -> float:
    """First moment about y=0 of a rectangular component above ``cut``."""
    if cut >= top:
        return 0.0
    lower = max(cut, bottom)
    return width * (top * top - lower * lower) / 2.0


def _circle_q(radius: float, cut: float) -> float:
    """First moment of a circle's area above a horizontal cut through its centre."""
    if cut <= -radius or cut >= radius:
        return 0.0
    return float(2.0 * (radius * radius - cut * cut) ** 1.5 / 3.0)


@dataclass(frozen=True)
class Material:
    """Linear-elastic material; UI-facing E is GPa and yield strength is MPa."""

    young_modulus_gpa: float
    yield_strength_mpa: float

    def __post_init__(self) -> None:
        _positive(
            "material",
            young_modulus_gpa=self.young_modulus_gpa,
            yield_strength_mpa=self.yield_strength_mpa,
        )

    @property
    def young_modulus_kn_m2(self) -> float:
        """Young's modulus in kN/m², matching moments expressed in kN·m."""
        return self.young_modulus_gpa * 1_000_000.0

    @property
    def yield_strength_kn_m2(self) -> float:
        """Yield strength in kN/m²."""
        return self.yield_strength_mpa * 1_000.0


class Section(ABC):
    """Cross-section properties about its horizontal centroidal axis."""

    @property
    @abstractmethod
    def area(self) -> float:
        """Material area (m²)."""

    @property
    @abstractmethod
    def centroid_from_bottom(self) -> float:
        """Centroid location measured upward from the section bottom (m)."""

    @property
    @abstractmethod
    def second_moment(self) -> float:
        """Second moment of area I about the centroidal axis (m⁴)."""

    @property
    @abstractmethod
    def y_top(self) -> float:
        """Signed coordinate of the top fibre relative to the centroid (m)."""

    @property
    @abstractmethod
    def y_bottom(self) -> float:
        """Signed coordinate of the bottom fibre relative to the centroid (m)."""

    @abstractmethod
    def width_at(self, y: float) -> float:
        """Total material width at centroidal coordinate ``y`` (m)."""

    @abstractmethod
    def first_moment_above(self, y: float) -> float:
        """First moment Q of material above a cut at centroidal coordinate ``y`` (m³)."""

    @property
    def section_modulus_top(self) -> float:
        """Elastic section modulus at the top fibre (m³)."""
        return self.second_moment / self.y_top

    @property
    def section_modulus_bottom(self) -> float:
        """Elastic section modulus at the bottom fibre (m³)."""
        return self.second_moment / abs(self.y_bottom)


@dataclass(frozen=True)
class RectangularSection(Section):
    """Solid rectangle or constant-thickness hollow box."""

    width: float
    height: float
    wall_thickness: float | None = None

    def __post_init__(self) -> None:
        _positive("rectangular section", width=self.width, height=self.height)
        if self.wall_thickness is not None:
            _positive("rectangular section", wall_thickness=self.wall_thickness)
            if 2.0 * self.wall_thickness >= min(self.width, self.height):
                raise InvalidSectionError(
                    "rectangular section: wall_thickness must leave a positive inner opening"
                )

    @property
    def _inner_width(self) -> float:
        return 0.0 if self.wall_thickness is None else self.width - 2.0 * self.wall_thickness

    @property
    def _inner_height(self) -> float:
        return 0.0 if self.wall_thickness is None else self.height - 2.0 * self.wall_thickness

    @property
    def area(self) -> float:
        return self.width * self.height - self._inner_width * self._inner_height

    @property
    def centroid_from_bottom(self) -> float:
        return self.height / 2.0

    @property
    def second_moment(self) -> float:
        return (self.width * self.height**3 - self._inner_width * self._inner_height**3) / 12.0

    @property
    def y_top(self) -> float:
        return self.height / 2.0

    @property
    def y_bottom(self) -> float:
        return -self.height / 2.0

    def width_at(self, y: float) -> float:
        if y < self.y_bottom or y > self.y_top:
            return 0.0
        if self.wall_thickness is not None and abs(y) < self._inner_height / 2.0:
            return self.width - self._inner_width
        return self.width

    def first_moment_above(self, y: float) -> float:
        outer = _rectangle_q(self.width, self.y_bottom, self.y_top, y)
        inner = _rectangle_q(
            self._inner_width, -self._inner_height / 2.0, self._inner_height / 2.0, y
        )
        return outer - inner


@dataclass(frozen=True)
class CircularSection(Section):
    """Solid circle or constant-thickness circular pipe."""

    diameter: float
    wall_thickness: float | None = None

    def __post_init__(self) -> None:
        _positive("circular section", diameter=self.diameter)
        if self.wall_thickness is not None:
            _positive("circular section", wall_thickness=self.wall_thickness)
            if 2.0 * self.wall_thickness >= self.diameter:
                raise InvalidSectionError(
                    "circular section: wall_thickness must leave a positive inner opening"
                )

    @property
    def _inner_diameter(self) -> float:
        return 0.0 if self.wall_thickness is None else self.diameter - 2.0 * self.wall_thickness

    @property
    def area(self) -> float:
        return math.pi * (self.diameter**2 - self._inner_diameter**2) / 4.0

    @property
    def centroid_from_bottom(self) -> float:
        return self.diameter / 2.0

    @property
    def second_moment(self) -> float:
        return math.pi * (self.diameter**4 - self._inner_diameter**4) / 64.0

    @property
    def y_top(self) -> float:
        return self.diameter / 2.0

    @property
    def y_bottom(self) -> float:
        return -self.diameter / 2.0

    def width_at(self, y: float) -> float:
        radius = self.diameter / 2.0
        if y < -radius or y > radius:
            return 0.0
        width = 2.0 * math.sqrt(max(0.0, radius * radius - y * y))
        inner_radius = self._inner_diameter / 2.0
        if inner_radius > 0.0 and abs(y) < inner_radius:
            width -= 2.0 * math.sqrt(inner_radius * inner_radius - y * y)
        return width

    def first_moment_above(self, y: float) -> float:
        return _circle_q(self.diameter / 2.0, y) - _circle_q(self._inner_diameter / 2.0, y)


@dataclass(frozen=True)
class ISection(Section):
    """Doubly symmetric I-section with equal top and bottom flanges."""

    height: float
    flange_width: float
    flange_thickness: float
    web_thickness: float

    def __post_init__(self) -> None:
        _positive(
            "I-section",
            height=self.height,
            flange_width=self.flange_width,
            flange_thickness=self.flange_thickness,
            web_thickness=self.web_thickness,
        )
        if 2.0 * self.flange_thickness >= self.height:
            raise InvalidSectionError("I-section: flanges must leave a positive web depth")
        if self.web_thickness > self.flange_width:
            raise InvalidSectionError("I-section: web_thickness cannot exceed flange_width")

    @property
    def _web_depth(self) -> float:
        return self.height - 2.0 * self.flange_thickness

    @property
    def area(self) -> float:
        return (
            2.0 * self.flange_width * self.flange_thickness + self.web_thickness * self._web_depth
        )

    @property
    def centroid_from_bottom(self) -> float:
        return self.height / 2.0

    @property
    def second_moment(self) -> float:
        return (
            self.flange_width * self.height**3
            - (self.flange_width - self.web_thickness) * self._web_depth**3
        ) / 12.0

    @property
    def y_top(self) -> float:
        return self.height / 2.0

    @property
    def y_bottom(self) -> float:
        return -self.height / 2.0

    def width_at(self, y: float) -> float:
        if y < self.y_bottom or y > self.y_top:
            return 0.0
        web_half = self._web_depth / 2.0
        return self.web_thickness if -web_half < y < web_half else self.flange_width

    def first_moment_above(self, y: float) -> float:
        web_half = self._web_depth / 2.0
        return sum(
            _rectangle_q(width, bottom, top, y)
            for width, bottom, top in (
                (self.flange_width, self.y_bottom, -web_half),
                (self.web_thickness, -web_half, web_half),
                (self.flange_width, web_half, self.y_top),
            )
        )


@dataclass(frozen=True)
class TSection(Section):
    """T-section with a top flange and a centred web below it."""

    flange_width: float
    flange_thickness: float
    web_depth: float
    web_thickness: float

    def __post_init__(self) -> None:
        _positive(
            "T-section",
            flange_width=self.flange_width,
            flange_thickness=self.flange_thickness,
            web_depth=self.web_depth,
            web_thickness=self.web_thickness,
        )
        if self.web_thickness > self.flange_width:
            raise InvalidSectionError("T-section: web_thickness cannot exceed flange_width")

    @property
    def _height(self) -> float:
        return self.web_depth + self.flange_thickness

    @property
    def area(self) -> float:
        return self.web_thickness * self.web_depth + self.flange_width * self.flange_thickness

    @property
    def centroid_from_bottom(self) -> float:
        web_area = self.web_thickness * self.web_depth
        flange_area = self.flange_width * self.flange_thickness
        return (
            web_area * self.web_depth / 2.0
            + flange_area * (self.web_depth + self.flange_thickness / 2.0)
        ) / self.area

    @property
    def second_moment(self) -> float:
        centroid = self.centroid_from_bottom
        web_area = self.web_thickness * self.web_depth
        flange_area = self.flange_width * self.flange_thickness
        return (
            self.web_thickness * self.web_depth**3 / 12.0
            + web_area * (self.web_depth / 2.0 - centroid) ** 2
            + self.flange_width * self.flange_thickness**3 / 12.0
            + flange_area * (self.web_depth + self.flange_thickness / 2.0 - centroid) ** 2
        )

    @property
    def y_top(self) -> float:
        return self._height - self.centroid_from_bottom

    @property
    def y_bottom(self) -> float:
        return -self.centroid_from_bottom

    def width_at(self, y: float) -> float:
        if y < self.y_bottom or y > self.y_top:
            return 0.0
        flange_bottom = self.web_depth - self.centroid_from_bottom
        return self.web_thickness if y < flange_bottom else self.flange_width

    def first_moment_above(self, y: float) -> float:
        centroid = self.centroid_from_bottom
        flange_bottom = self.web_depth - centroid
        return _rectangle_q(self.web_thickness, -centroid, flange_bottom, y) + _rectangle_q(
            self.flange_width, flange_bottom, self.y_top, y
        )


@dataclass(frozen=True)
class PropertySpan:
    """One contiguous span with constant material and cross-section."""

    x_start: float
    x_end: float
    material: Material
    section: Section

    def __post_init__(self) -> None:
        if not math.isfinite(self.x_start) or not math.isfinite(self.x_end):
            raise InvalidSectionError("property span: boundaries must be finite")
        if self.x_end <= self.x_start:
            raise InvalidSectionError(
                f"property span: x_end ({self.x_end}) must be greater than x_start ({self.x_start})"
            )

    @property
    def ei(self) -> float:
        """Flexural rigidity EI (kN·m²)."""
        return self.material.young_modulus_kn_m2 * self.section.second_moment

    @property
    def ea(self) -> float:
        """Axial rigidity EA (kN)."""
        return self.material.young_modulus_kn_m2 * self.section.area
