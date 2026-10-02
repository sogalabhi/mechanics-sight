"""Tensile material presets: the loading curve ("backbone") of an idealised steel.

Units: stress in MPa, strain dimensionless (engineering strain), Young's modulus in GPa at the
interface and MPa internally. Tension is positive. Every preset says what it is: this one is an
*educational idealisation*, not a measured steel.
"""

import math
from dataclasses import dataclass

from beam_solver.errors import UnknownPresetError

PROOF_OFFSET = 0.002
"""The usual proof offset: 0.2 % residual strain (dimensionless)."""


@dataclass(frozen=True)
class Landmark:
    """A named point on the curve."""

    id: str
    name: str
    strain: float
    stress_mpa: float


@dataclass(frozen=True)
class TensilePreset:
    """Mild steel, textbook curve with points A to F (docs/STEEL_LAB_CONTRACT.md section 4).

    Regions: linear to A, reversible curving to B (permanent strain starts just past B), yield
    onset to the upper yield C, the drop to the lower yield D, a plateau to ``strain_hardening``,
    a parabolic hardening rise to the peak E, then a parabolic necking fall to fracture F.
    """

    id: str
    name: str
    kind: str
    young_modulus_gpa: float
    proportional_limit_mpa: float  # A
    elastic_limit_mpa: float  # B
    upper_yield_mpa: float  # C
    lower_yield_mpa: float  # D, the design yield strength
    peak_mpa: float  # E, ultimate tensile strength
    fracture_mpa: float  # F, engineering stress at the break
    strain_upper_yield: float
    strain_lower_yield: float
    strain_hardening: float
    strain_peak: float
    strain_fracture: float
    curving_per_mpa2: float  # kappa: extra strain kappa*(sigma - sigma_A)^2 on the A to B curve

    @property
    def young_modulus_mpa(self) -> float:
        """Young's modulus E in MPa."""
        return self.young_modulus_gpa * 1000.0

    @property
    def strain_a(self) -> float:
        """Strain at the proportional limit: sigma_A / E."""
        return self.proportional_limit_mpa / self.young_modulus_mpa

    @property
    def strain_b(self) -> float:
        """Strain at the elastic limit: sigma_B / E plus the A to B curving offset."""
        s = self.elastic_limit_mpa - self.proportional_limit_mpa
        return self.elastic_limit_mpa / self.young_modulus_mpa + self.curving_per_mpa2 * s * s

    def validate(self) -> None:
        """Check the parameters describe a sensible curve (ValueError: a programming error)."""
        ordered = (
            0.0 < self.proportional_limit_mpa < self.elastic_limit_mpa < self.upper_yield_mpa,
            self.lower_yield_mpa < self.upper_yield_mpa,
            self.lower_yield_mpa < self.peak_mpa,
            self.fracture_mpa < self.peak_mpa,
            self.strain_a < self.strain_b < self.strain_upper_yield < self.strain_lower_yield,
            self.strain_lower_yield < self.strain_hardening < self.strain_peak,
            self.strain_peak < self.strain_fracture,
            math.isfinite(self.curving_per_mpa2) and self.curving_per_mpa2 > 0.0,
        )
        if not all(ordered):
            raise ValueError(f"preset {self.id!r} is not a valid curve")

    def stress(self, strain: float) -> float:
        """Backbone engineering stress (MPa) at a strain, loading beyond all prior strain."""
        e = strain
        if e <= self.strain_a:
            return self.young_modulus_mpa * e
        if e <= self.strain_b:
            # kappa*s^2 + s/E = e - e_A, solved for s = sigma - sigma_A (the positive root).
            c = 1.0 / self.young_modulus_mpa
            k = self.curving_per_mpa2
            s = (-c + math.sqrt(c * c + 4.0 * k * (e - self.strain_a))) / (2.0 * k)
            return self.proportional_limit_mpa + s
        if e <= self.strain_upper_yield:
            t = (e - self.strain_b) / (self.strain_upper_yield - self.strain_b)
            return self.elastic_limit_mpa + (self.upper_yield_mpa - self.elastic_limit_mpa) * t
        if e <= self.strain_lower_yield:
            t = (e - self.strain_upper_yield) / (self.strain_lower_yield - self.strain_upper_yield)
            return self.upper_yield_mpa + (self.lower_yield_mpa - self.upper_yield_mpa) * t
        if e <= self.strain_hardening:
            return self.lower_yield_mpa
        if e <= self.strain_peak:
            r = (self.strain_peak - e) / (self.strain_peak - self.strain_hardening)
            return self.peak_mpa - (self.peak_mpa - self.lower_yield_mpa) * r * r
        q = (e - self.strain_peak) / (self.strain_fracture - self.strain_peak)
        return self.peak_mpa - (self.peak_mpa - self.fracture_mpa) * q * q

    def plastic_strain(self, max_strain: float) -> float:
        """Permanent strain left after unloading from the backbone at ``max_strain``.

        Zero up to the elastic limit B (fully recoverable). Beyond B it is
        ``max_strain - stress/E``: where the unloading line of slope E reaches zero stress.
        """
        if max_strain <= self.strain_b:
            return 0.0
        return max_strain - self.stress(max_strain) / self.young_modulus_mpa

    def proof_point(self, offset: float = PROOF_OFFSET) -> tuple[float, float]:
        """Offset proof point: where the loading curve meets the line ``E*(strain - offset)``.

        Returns ``(strain, stress_mpa)``. Unloading from this point on a line of slope E leaves
        exactly ``offset`` of permanent strain, which is what an offset proof strength means
        (the offset is a *residual* strain, not the total strain at the point). The curve never
        rises faster than E, so the gap curve minus line only shrinks and the crossing is unique.
        """
        if not 0.0 < offset < self.strain_fracture:
            raise ValueError("the proof offset must lie between zero and the fracture strain")
        e_mod = self.young_modulus_mpa
        lo, hi = offset, self.strain_fracture
        for _ in range(200):
            mid = (lo + hi) / 2.0
            if self.stress(mid) - e_mod * (mid - offset) > 0.0:
                lo = mid
            else:
                hi = mid
        strain = (lo + hi) / 2.0
        return strain, self.stress(strain)

    def landmarks(self) -> tuple[Landmark, ...]:
        """The six textbook points, in order A to F."""
        return (
            Landmark("A", "proportional_limit", self.strain_a, self.proportional_limit_mpa),
            Landmark("B", "elastic_limit", self.strain_b, self.elastic_limit_mpa),
            Landmark("C", "upper_yield", self.strain_upper_yield, self.upper_yield_mpa),
            Landmark("D", "lower_yield", self.strain_lower_yield, self.lower_yield_mpa),
            Landmark("E", "ultimate_tensile_strength", self.strain_peak, self.peak_mpa),
            Landmark("F", "fracture", self.strain_fracture, self.fracture_mpa),
        )


STEEL_TEXTBOOK = TensilePreset(
    id="steel_textbook",
    name="Mild steel, textbook curve",
    kind="idealisation",
    young_modulus_gpa=200.0,
    proportional_limit_mpa=230.0,
    elastic_limit_mpa=240.0,
    upper_yield_mpa=265.0,
    lower_yield_mpa=250.0,
    peak_mpa=400.0,
    fracture_mpa=300.0,
    strain_upper_yield=0.0014,
    strain_lower_yield=0.0016,
    strain_hardening=0.015,
    strain_peak=0.15,
    strain_fracture=0.25,
    curving_per_mpa2=2e-7,
)
STEEL_TEXTBOOK.validate()

PRESETS: dict[str, TensilePreset] = {STEEL_TEXTBOOK.id: STEEL_TEXTBOOK}


def get_preset(preset_id: str) -> TensilePreset:
    """Look a preset up by id."""
    try:
        return PRESETS[preset_id]
    except KeyError:
        raise UnknownPresetError(f"unknown material preset {preset_id!r}") from None
