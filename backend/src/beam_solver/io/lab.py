"""JSON schemas and conversion for the material lab (POST /api/v1/lab/tension).

Units: strain dimensionless (engineering), stress MPa (engineering), force kN, lengths mm.
Tension positive. Contract: docs/STEEL_LAB_CONTRACT.md.
"""

from dataclasses import asdict
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from beam_solver.material import (
    Operation,
    Reset,
    Specimen,
    StrainTo,
    TensionResult,
    UnloadToZeroStress,
    get_preset,
    run_tension,
)

SCHEMA_VERSION: Literal[1] = 1
MAX_HISTORY = 500

Region = Literal[
    "elastic",
    "elastic_curving",
    "yield_onset",
    "yield_drop",
    "yield_plateau",
    "strain_hardening",
    "necking",
    "unloading",
    "reloading",
    "fractured",
]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SpecimenIn(_Model):
    diameter_mm: float = Field(gt=0, le=1000, description="mm, original diameter d0")
    gauge_length_mm: float = Field(gt=0, le=10000, description="mm, original gauge length L0")


class StrainOpIn(_Model):
    op: Literal["strain"]
    to: float = Field(
        allow_inf_nan=False,
        description="Total engineering strain to move to (fraction). Lower than now unloads.",
    )


class UnloadOpIn(_Model):
    op: Literal["unload_to_zero_stress"]


class ResetOpIn(_Model):
    op: Literal["reset"]


LabOpIn = Annotated[StrainOpIn | UnloadOpIn | ResetOpIn, Field(discriminator="op")]


class TensionIn(_Model):
    schema_version: Literal[1] = SCHEMA_VERSION
    preset: str = Field(min_length=1, max_length=32, description="Material preset id")
    specimen: SpecimenIn
    history: list[LabOpIn] = Field(
        default_factory=list,
        max_length=MAX_HISTORY,
        description="Loading history, replayed on a fresh specimen. Empty is a fresh specimen.",
    )


class TensionStateOut(_Model):
    strain: float = Field(description="Total engineering strain (fraction)")
    stress_mpa: float = Field(description="Engineering stress F/A0, MPa (never negative)")
    force_kn: float = Field(description="Force, kN")
    extension_mm: float = Field(description="Extension of the gauge length, mm (strain times L0)")
    plastic_strain: float = Field(description="Permanent strain left if unloaded now (fraction)")
    elastic_strain: float = Field(
        description="strain minus plastic_strain; 0 after fracture (the recoverable part is lost)"
    )
    max_strain: float = Field(description="Largest strain reached on the loading curve")
    region: Region
    landmark: str | None = Field(
        description="A to F when the strain equals that point exactly, otherwise null"
    )


class TracePointOut(_Model):
    strain: float
    stress_mpa: float
    plastic_strain: float = Field(description="Permanent strain at this point (fraction)")
    region: Region


class LandmarkOut(_Model):
    id: str = Field(description="A proportional limit … F fracture")
    name: str
    strain: float
    stress_mpa: float
    reached: bool = Field(description="The specimen has reached or passed this strain")


class ModelOut(_Model):
    preset: str
    name: str
    kind: Literal["idealisation"]
    young_modulus_gpa: float
    parameters: dict[str, float] = Field(
        description="The preset's numeric parameters (stresses in MPa, strains as fractions)"
    )


class SpecimenOut(_Model):
    diameter_mm: float
    gauge_length_mm: float
    area_mm2: float = Field(description="Original area A0, mm²")


class TensionOut(_Model):
    schema_version: Literal[1] = SCHEMA_VERSION
    state: TensionStateOut
    trace: list[TracePointOut] = Field(
        description="The stress-strain path taken, in order: dense on curved pieces, exact corners"
    )
    landmarks: list[LandmarkOut] = Field(description="All six points A to F")
    model: ModelOut
    specimen: SpecimenOut
    warnings: list[str] = Field(default_factory=list)


def operations_from_schema(history: list[LabOpIn]) -> list[Operation]:
    """Request history -> model operations."""
    out: list[Operation] = []
    for item in history:
        if isinstance(item, StrainOpIn):
            out.append(StrainTo(item.to))
        elif isinstance(item, UnloadOpIn):
            out.append(UnloadToZeroStress())
        else:
            out.append(Reset())
    return out


def tension_result_to_schema(
    result: TensionResult, *, preset_id: str, specimen: Specimen
) -> TensionOut:
    """Model result -> response."""
    preset = get_preset(preset_id)
    s = result.state
    return TensionOut(
        state=TensionStateOut(
            strain=s.strain,
            stress_mpa=s.stress_mpa,
            force_kn=s.force_kn,
            extension_mm=s.extension_mm,
            plastic_strain=s.plastic_strain,
            elastic_strain=s.elastic_strain,
            max_strain=s.max_strain,
            region=s.region,  # type: ignore[arg-type]  # the model only emits the Region names
            landmark=s.landmark,
        ),
        trace=[
            TracePointOut(
                strain=t.strain,
                stress_mpa=t.stress_mpa,
                plastic_strain=t.plastic_strain,
                region=t.region,  # type: ignore[arg-type]  # the model only emits the Region names
            )
            for t in result.trace
        ],
        landmarks=[
            LandmarkOut(
                id=m.id, name=m.name, strain=m.strain, stress_mpa=m.stress_mpa, reached=m.reached
            )
            for m in result.landmarks
        ],
        model=ModelOut(
            preset=preset.id,
            name=preset.name,
            kind="idealisation",
            young_modulus_gpa=preset.young_modulus_gpa,
            parameters={k: v for k, v in asdict(preset).items() if isinstance(v, float)},
        ),
        specimen=SpecimenOut(
            diameter_mm=specimen.diameter_mm,
            gauge_length_mm=specimen.gauge_length_mm,
            area_mm2=specimen.area_mm2,
        ),
    )


def run_tension_request(request: TensionIn) -> TensionOut:
    """Validate the preset and specimen, replay the history, and build the response."""
    preset = get_preset(request.preset)
    specimen = Specimen(request.specimen.diameter_mm, request.specimen.gauge_length_mm)
    result = run_tension(preset, specimen, operations_from_schema(request.history))
    return tension_result_to_schema(result, preset_id=preset.id, specimen=specimen)
