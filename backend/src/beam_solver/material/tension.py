"""Strain-controlled tension test of a round bar.

The caller commands strain; the preset's material law decides stress. The test is stateless: the
whole loading history goes in and the final state and the exact path come out, so any state can be
reproduced and replayed. Behaviour rules are in docs/STEEL_LAB_CONTRACT.md section 5.

Units: strain dimensionless (engineering strain, tension positive), stress MPa (engineering stress,
force over the original area), force kN, lengths mm. A tension test only pulls: stress never goes
below zero.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass

from beam_solver.errors import (
    InvalidSpecimenError,
    SpecimenBrokenError,
    StrainOutOfRangeError,
    UnsupportedOperationError,
)
from beam_solver.material.presets import PROOF_OFFSET, Landmark, TensilePreset
from beam_solver.tolerances import STRAIN_TOL

MAX_TRACE_STEP = 0.004
"""Largest strain gap (dimensionless) between consecutive sampled trace points on a curved piece."""


@dataclass(frozen=True)
class Specimen:
    """A round tension specimen. Engineering stress uses the original area ``A0``."""

    diameter_mm: float
    gauge_length_mm: float

    def __post_init__(self) -> None:
        for name, value in (
            ("diameter_mm", self.diameter_mm),
            ("gauge_length_mm", self.gauge_length_mm),
        ):
            if not math.isfinite(value) or value <= 0.0:
                raise InvalidSpecimenError(f"specimen: {name} must be finite and greater than zero")

    @property
    def area_mm2(self) -> float:
        """Original cross-sectional area A0 in mm²."""
        return math.pi * self.diameter_mm**2 / 4.0


@dataclass(frozen=True)
class StrainTo:
    """Move the total engineering strain to ``to`` (loading, or unloading if it is lower)."""

    to: float


@dataclass(frozen=True)
class UnloadToZeroStress:
    """Remove the load: strain returns to the permanent strain, where the stress is zero."""


@dataclass(frozen=True)
class Reset:
    """Discard everything before this point and start a fresh specimen."""


Operation = StrainTo | UnloadToZeroStress | Reset


@dataclass(frozen=True)
class TensionState:
    """The specimen at one instant. Tension positive."""

    strain: float
    stress_mpa: float
    force_kn: float
    extension_mm: float
    plastic_strain: float
    elastic_strain: float
    max_strain: float
    region: str
    landmark: str | None


@dataclass(frozen=True)
class TracePoint:
    """One point of the stress-strain path: a complete state, so a replay can show exact values."""

    strain: float
    stress_mpa: float
    plastic_strain: float
    region: str


@dataclass(frozen=True)
class LandmarkStatus:
    """A preset landmark and whether the specimen has reached it."""

    id: str
    name: str
    strain: float
    stress_mpa: float
    reached: bool


@dataclass(frozen=True)
class ProofStrength:
    """The offset proof point of the preset's curve (independent of the loading history)."""

    offset_strain: float
    strain: float
    stress_mpa: float


@dataclass(frozen=True)
class TensionResult:
    """Final state, the exact path taken, the landmarks and the proof point of the preset."""

    state: TensionState
    trace: tuple[TracePoint, ...]
    landmarks: tuple[LandmarkStatus, ...]
    proof: ProofStrength


def run_tension(
    preset: TensilePreset, specimen: Specimen, history: Sequence[Operation]
) -> TensionResult:
    """Replay ``history`` on a fresh specimen and return the final state and path."""
    machine = _Machine(preset, specimen)
    for op in history:
        machine.apply(op)
    return machine.result()


class _Machine:
    """Mutable replay state. ``back`` is the largest strain reached on the backbone."""

    def __init__(self, preset: TensilePreset, specimen: Specimen) -> None:
        self.p = preset
        self.sp = specimen
        self._fresh()

    def _fresh(self) -> None:
        self.e = 0.0
        self.back = 0.0
        self.direction = 0
        self.broken = False
        self.trace: list[TracePoint] = [TracePoint(0.0, 0.0, 0.0, "elastic")]

    # ---- operations -----------------------------------------------------------------------
    def apply(self, op: Operation) -> None:
        if isinstance(op, Reset):
            self._fresh()
            return
        if self.broken:
            raise SpecimenBrokenError("the specimen has fractured; only a reset applies")
        if isinstance(op, StrainTo):
            self._move_to(self._checked(op.to))
        elif isinstance(op, UnloadToZeroStress):
            self._move_to(self.p.plastic_strain(self.back))
        else:  # pragma: no cover - the union is exhaustive; guards a future op added without a case
            raise UnsupportedOperationError(f"unsupported operation {op!r}")

    def _checked(self, to: float) -> float:
        limit = self.p.strain_fracture
        if not math.isfinite(to) or to < -STRAIN_TOL or to > limit + STRAIN_TOL:
            raise StrainOutOfRangeError(
                f"strain {to} is outside the valid range 0 to {limit} for preset {self.p.id!r}"
            )
        return min(max(to, 0.0), limit)

    def _move_to(self, target: float) -> None:
        p = self.p
        # A tension test cannot go below zero stress: stop where the unloading line reaches zero.
        e1 = max(p.plastic_strain(self.back), target)
        if abs(e1 - self.e) <= STRAIN_TOL:
            return
        reversible = self.back <= p.strain_b + STRAIN_TOL
        if e1 >= self.back - STRAIN_TOL:
            if self.e < self.back - STRAIN_TOL:
                if reversible:  # rejoin the maximum along the reversible curve
                    self._follow(self.e, self.back)
                else:  # elastic reloading line ends on the backbone at the old maximum
                    self._add(
                        self.back,
                        p.stress(self.back),
                        p.plastic_strain(self.back),
                        self._zone(self.back),
                    )
            self._follow(max(self.e, self.back), e1)
            self.back = max(self.back, e1)
        elif reversible:
            self._follow(self.e, e1)  # retrace the reversible curve downwards
        else:
            self._add(
                e1,
                p.young_modulus_mpa * (e1 - p.plastic_strain(self.back)),
                p.plastic_strain(self.back),
                "unloading",
            )
        self.direction = 1 if e1 > self.e else -1
        self.e = e1
        if e1 >= p.strain_fracture - STRAIN_TOL:
            self.broken = True
            drop = p.strain_fracture - p.fracture_mpa / p.young_modulus_mpa
            self._add(drop, 0.0, drop, "fractured")

    def _add(self, strain: float, stress: float, plastic: float, region: str) -> None:
        self.trace.append(TracePoint(strain, stress, plastic, region))

    def _follow(self, a: float, b: float) -> None:
        """Append the backbone between two strains (either order), dropping the start point."""
        pts = self._samples(min(a, b), max(a, b))
        if b < a:
            pts.reverse()
        for e in pts[1:]:
            self._add(e, self.p.stress(e), self.p.plastic_strain(e), self._zone(e))

    def _samples(self, a: float, b: float) -> list[float]:
        """Strains from ``a`` to ``b``: every landmark inside, and a dense grid on curved pieces."""
        p = self.p
        pts = [a, b]
        pts += [lm.strain for lm in p.landmarks() if a + STRAIN_TOL < lm.strain < b - STRAIN_TOL]
        pts.append(p.strain_hardening)
        n = max(1, math.ceil((b - a) / MAX_TRACE_STEP))
        pts += [a + (b - a) * i / n for i in range(1, n)]
        if b <= p.strain_b + STRAIN_TOL:  # the short curved reversible zone: a few more points
            pts += [a + (b - a) * i / 12 for i in range(1, 12)]
        out: list[float] = []
        for e in sorted(x for x in pts if a - STRAIN_TOL <= x <= b + STRAIN_TOL):
            if not out or e - out[-1] > STRAIN_TOL:
                out.append(e)
        return out

    # ---- readout --------------------------------------------------------------------------
    def _stress(self) -> float:
        p = self.p
        if self.broken:
            return 0.0
        if self.e >= self.back - STRAIN_TOL or self.back <= p.strain_b + STRAIN_TOL:
            return p.stress(self.e)
        return max(0.0, p.young_modulus_mpa * (self.e - p.plastic_strain(self.back)))

    def _region(self) -> str:
        p = self.p
        if self.broken:
            return "fractured"
        on_backbone = self.e >= self.back - STRAIN_TOL
        beyond_b = self.back > p.strain_b + STRAIN_TOL
        if beyond_b and not on_backbone:
            return "unloading" if self.direction < 0 else "reloading"
        return self._zone(self.e)

    def _zone(self, e: float) -> str:
        """Backbone piece a strain lies on (a limit belongs to the lower piece)."""
        p = self.p
        for limit, name in (
            (p.strain_a, "elastic"),
            (p.strain_b, "elastic_curving"),
            (p.strain_upper_yield, "yield_onset"),
            (p.strain_lower_yield, "yield_drop"),
            (p.strain_hardening, "yield_plateau"),
            (p.strain_peak, "strain_hardening"),
        ):
            if e <= limit + STRAIN_TOL:
                return name
        return "necking"

    def _landmark(self) -> Landmark | None:
        if self.e < self.back - STRAIN_TOL:
            return None
        for lm in self.p.landmarks():
            if abs(self.e - lm.strain) <= STRAIN_TOL:
                return lm
        return None

    def state(self) -> TensionState:
        p = self.p
        stress = self._stress()
        if self.broken:
            plastic = p.strain_fracture - p.fracture_mpa / p.young_modulus_mpa
            elastic = 0.0  # the recoverable part is lost when the bar separates
        else:
            plastic = p.plastic_strain(self.back)
            elastic = self.e - plastic
        lm = self._landmark()
        return TensionState(
            strain=self.e,
            stress_mpa=stress,
            force_kn=stress * self.sp.area_mm2 / 1000.0,
            extension_mm=self.e * self.sp.gauge_length_mm,
            plastic_strain=plastic,
            elastic_strain=elastic,
            max_strain=self.back,
            region=self._region(),
            landmark=lm.id if lm else None,
        )

    def result(self) -> TensionResult:
        reached = self.back
        marks = tuple(
            LandmarkStatus(
                lm.id, lm.name, lm.strain, lm.stress_mpa, reached >= lm.strain - STRAIN_TOL
            )
            for lm in self.p.landmarks()
        )
        strain, stress = self.p.proof_point()
        proof = ProofStrength(PROOF_OFFSET, strain, stress)
        return TensionResult(self.state(), tuple(self.trace), marks, proof)
