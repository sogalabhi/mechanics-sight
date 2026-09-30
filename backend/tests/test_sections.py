"""Phase 3 material and cross-section geometry benchmarks."""

import math
from collections.abc import Callable

import pytest

from beam_solver.domain import (
    CircularSection,
    ISection,
    Material,
    RectangularSection,
    Section,
    TSection,
)
from beam_solver.errors import InvalidSectionError


def test_material_units_and_validation() -> None:
    steel = Material(200.0, 250.0)
    assert steel.young_modulus_kn_m2 == 200_000_000.0
    assert steel.yield_strength_kn_m2 == 250_000.0
    for values in ((0.0, 250.0), (200.0, -1.0), (math.inf, 250.0), (200.0, math.nan)):
        with pytest.raises(InvalidSectionError):
            Material(*values)


def test_solid_rectangle_properties_and_q() -> None:
    section = RectangularSection(width=0.2, height=0.4)
    assert isinstance(section, Section)
    assert section.area == pytest.approx(0.08)
    assert section.centroid_from_bottom == pytest.approx(0.2)
    assert section.second_moment == pytest.approx(0.2 * 0.4**3 / 12.0)
    assert section.y_top == pytest.approx(0.2)
    assert section.y_bottom == pytest.approx(-0.2)
    assert section.section_modulus_top == pytest.approx(section.second_moment / 0.2)
    assert section.section_modulus_bottom == pytest.approx(section.second_moment / 0.2)
    assert section.width_at(0.0) == pytest.approx(0.2)
    assert section.width_at(0.3) == 0.0
    assert section.first_moment_above(0.0) == pytest.approx(0.2 * 0.4**2 / 8.0)
    assert section.first_moment_above(section.y_top) == 0.0
    assert section.first_moment_above(section.y_bottom) == pytest.approx(0.0, abs=1e-15)


def test_hollow_box_subtracts_inner_opening() -> None:
    section = RectangularSection(width=0.2, height=0.3, wall_thickness=0.02)
    inner_width, inner_height = 0.16, 0.26
    assert section.area == pytest.approx(0.2 * 0.3 - inner_width * inner_height)
    assert section.second_moment == pytest.approx(
        (0.2 * 0.3**3 - inner_width * inner_height**3) / 12.0
    )
    assert section.width_at(0.0) == pytest.approx(0.04)
    assert section.width_at(0.14) == pytest.approx(0.2)
    assert section.first_moment_above(0.0) == pytest.approx(
        0.2 * 0.3**2 / 8.0 - inner_width * inner_height**2 / 8.0
    )


def test_solid_circle_properties_and_q() -> None:
    section = CircularSection(diameter=0.4)
    radius = 0.2
    assert section.area == pytest.approx(math.pi * radius**2)
    assert section.centroid_from_bottom == pytest.approx(radius)
    assert section.second_moment == pytest.approx(math.pi * 0.4**4 / 64.0)
    assert section.width_at(0.0) == pytest.approx(0.4)
    assert section.first_moment_above(0.0) == pytest.approx(2.0 * radius**3 / 3.0)
    assert section.first_moment_above(radius) == 0.0
    assert section.first_moment_above(-radius) == 0.0


def test_pipe_properties_and_centre_width() -> None:
    section = CircularSection(diameter=0.4, wall_thickness=0.05)
    inner = 0.3
    assert section.area == pytest.approx(math.pi * (0.4**2 - inner**2) / 4.0)
    assert section.second_moment == pytest.approx(math.pi * (0.4**4 - inner**4) / 64.0)
    assert section.width_at(0.0) == pytest.approx(0.1)
    assert section.first_moment_above(0.0) == pytest.approx(
        2.0 * ((0.4 / 2.0) ** 3 - (inner / 2.0) ** 3) / 3.0
    )


def test_i_section_properties_and_first_moment() -> None:
    section = ISection(
        height=0.4,
        flange_width=0.2,
        flange_thickness=0.02,
        web_thickness=0.01,
    )
    web_depth = 0.36
    assert section.area == pytest.approx(2.0 * 0.2 * 0.02 + 0.01 * web_depth)
    assert section.centroid_from_bottom == pytest.approx(0.2)
    assert section.second_moment == pytest.approx(
        (0.2 * 0.4**3 - (0.2 - 0.01) * web_depth**3) / 12.0
    )
    assert section.width_at(0.0) == pytest.approx(0.01)
    assert section.width_at(0.19) == pytest.approx(0.2)
    expected_q_at_neutral_axis = 0.2 * 0.02 * 0.19 + 0.01 * 0.18 * 0.09
    assert section.first_moment_above(0.0) == pytest.approx(expected_q_at_neutral_axis)


def test_t_section_uses_parallel_axis_theorem() -> None:
    section = TSection(
        flange_width=0.2,
        flange_thickness=0.02,
        web_depth=0.18,
        web_thickness=0.01,
    )
    web_area, flange_area = 0.01 * 0.18, 0.2 * 0.02
    centroid = (web_area * 0.09 + flange_area * 0.19) / (web_area + flange_area)
    expected_i = (
        0.01 * 0.18**3 / 12.0
        + web_area * (0.09 - centroid) ** 2
        + 0.2 * 0.02**3 / 12.0
        + flange_area * (0.19 - centroid) ** 2
    )
    assert section.area == pytest.approx(web_area + flange_area)
    assert section.centroid_from_bottom == pytest.approx(centroid)
    assert section.second_moment == pytest.approx(expected_i)
    assert section.y_bottom == pytest.approx(-centroid)
    assert section.y_top == pytest.approx(0.2 - centroid)
    assert section.width_at(0.0) == pytest.approx(0.01)
    assert section.width_at(section.y_top - 0.001) == pytest.approx(0.2)
    assert section.first_moment_above(section.y_bottom) == pytest.approx(0.0, abs=1e-15)
    assert section.first_moment_above(0.0) > 0.0


@pytest.mark.parametrize(
    "factory",
    [
        lambda: RectangularSection(0.0, 0.2),
        lambda: RectangularSection(0.2, 0.2, 0.1),
        lambda: CircularSection(0.2, 0.1),
        lambda: ISection(0.2, 0.1, 0.1, 0.01),
        lambda: ISection(0.2, 0.1, 0.01, 0.2),
        lambda: TSection(0.2, 0.02, 0.2, 0.3),
    ],
)
def test_invalid_section_dimensions(factory: Callable[[], Section]) -> None:
    with pytest.raises(InvalidSectionError):
        factory()
