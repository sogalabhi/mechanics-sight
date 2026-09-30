"""JSON schemas shared by the CLI and the API (plan.md Section 10). SI units throughout."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION: Literal[1] = 1
MAX_LENGTH = 1000.0
MAX_SUPPORTS = 20
MAX_LOADS = 100
MAX_HINGES = 10

Id = Annotated[str, Field(min_length=1, max_length=32)]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SupportIn(_Model):
    id: Id
    type: Literal["pin", "roller", "fixed"]
    position: float = Field(description="m from the left end")


class PointLoadIn(_Model):
    id: Id
    type: Literal["point"]
    position: float
    magnitude: float = Field(description="kN, upward positive")
    fx: float = Field(default=0.0, description="kN, rightward positive (horizontal)")


class PointMomentIn(_Model):
    id: Id
    type: Literal["moment"]
    position: float
    magnitude: float = Field(description="kN·m, anticlockwise positive")


class DistributedLoadIn(_Model):
    id: Id
    type: Literal["distributed"]
    start: float
    end: float
    w_start: float = Field(description="kN/m, upward positive")
    w_end: float = Field(description="kN/m, upward positive")


LoadIn = Annotated[PointLoadIn | PointMomentIn | DistributedLoadIn, Field(discriminator="type")]


class MaterialIn(_Model):
    young_modulus_gpa: float = Field(gt=0, description="Young's modulus in GPa")
    yield_strength_mpa: float = Field(gt=0, description="Yield strength in MPa")


class RectangularSectionIn(_Model):
    type: Literal["rectangle"]
    width: float = Field(gt=0, description="m")
    height: float = Field(gt=0, description="m")
    wall_thickness: float | None = Field(default=None, gt=0, description="m; omit for solid")


class CircularSectionIn(_Model):
    type: Literal["circle"]
    diameter: float = Field(gt=0, description="m")
    wall_thickness: float | None = Field(default=None, gt=0, description="m; omit for solid")


class ISectionIn(_Model):
    type: Literal["i"]
    height: float = Field(gt=0, description="m")
    flange_width: float = Field(gt=0, description="m")
    flange_thickness: float = Field(gt=0, description="m")
    web_thickness: float = Field(gt=0, description="m")


class TSectionIn(_Model):
    type: Literal["t"]
    flange_width: float = Field(gt=0, description="m")
    flange_thickness: float = Field(gt=0, description="m")
    web_depth: float = Field(gt=0, description="m")
    web_thickness: float = Field(gt=0, description="m")


SectionIn = Annotated[
    RectangularSectionIn | CircularSectionIn | ISectionIn | TSectionIn,
    Field(discriminator="type"),
]


class PropertySpanIn(_Model):
    x_start: float = Field(description="m from the left end")
    x_end: float = Field(description="m from the left end")
    material: MaterialIn
    section: SectionIn


class BeamIn(_Model):
    schema_version: Literal[1] = SCHEMA_VERSION
    length: float = Field(gt=0, le=MAX_LENGTH, description="m")
    supports: list[SupportIn] = Field(min_length=1, max_length=MAX_SUPPORTS)
    loads: list[LoadIn] = Field(default_factory=list, max_length=MAX_LOADS)
    hinges: list[float] = Field(
        default_factory=list,
        max_length=MAX_HINGES,
        description="Positions of internal moment hinges in m from the left end",
    )
    material: MaterialIn | None = Field(
        default=None, description="Constant linear-elastic material for physical analysis"
    )
    section: SectionIn | None = Field(
        default=None, description="Constant cross-section over the complete beam"
    )
    spans: list[PropertySpanIn] | None = Field(
        default=None,
        description="Contiguous property spans covering [0, L]; alternative to uniform material/section",
    )

    @model_validator(mode="after")
    def physical_properties_are_complete(self) -> "BeamIn":
        has_uniform = self.material is not None or self.section is not None
        has_spans = self.spans is not None and len(self.spans) > 0
        if has_uniform and has_spans:
            raise ValueError("provide either uniform material/section or property spans, not both")
        if (self.material is None) != (self.section is None):
            raise ValueError("material and section must be supplied together")
        return self


class ClassificationOut(_Model):
    status: Literal["unstable", "determinate", "indeterminate"]
    restraints: int
    equations: int
    degree: int
    axial_degree: int
    bending_degree: int
    reason: str | None = None


class ReactionOut(_Model):
    support_id: str
    fx: float
    fy: float
    moment: float


class SegmentOut(_Model):
    x_start: float
    x_end: float
    shear: list[float] = Field(
        description="Ascending coefficients in t = x - x_start; valid strictly inside"
    )
    moment: list[float] = Field(
        description="Ascending coefficients in t = x - x_start; valid strictly inside"
    )
    axial: list[float] = Field(
        default_factory=lambda: [0.0],
        description="Ascending coefficients of N(x) in t = x - x_start (kN, tension positive)",
    )


class CriticalPointOut(_Model):
    x: float
    shear_left: float
    shear_right: float
    moment_left: float
    moment_right: float
    axial_left: float = 0.0
    axial_right: float = 0.0


class ExtremeOut(_Model):
    x: float
    value: float


class DeflectionSegmentOut(_Model):
    x_start: float
    x_end: float
    slope: list[float] = Field(
        description="Ascending coefficients in t = x - x_start; rotation in rad"
    )
    deflection: list[float] = Field(
        description="Ascending coefficients in t = x - x_start; displacement in m, upward positive"
    )


class DeflectionOut(_Model):
    segments: list[DeflectionSegmentOut]
    max_upward: ExtremeOut | None
    max_downward: ExtremeOut | None
    max_absolute: ExtremeOut


class ExtremesOut(_Model):
    max_sagging: ExtremeOut | None
    max_hogging: ExtremeOut | None
    max_positive_shear: ExtremeOut | None
    max_negative_shear: ExtremeOut | None
    max_tension: ExtremeOut | None = None
    max_compression: ExtremeOut | None = None


class BendingStressSegmentOut(_Model):
    x_start: float
    x_end: float
    sigma_top: list[float] = Field(
        description="Top fibre stress ascending coefficients in t = x - x_start (kN/m²)"
    )
    sigma_bottom: list[float] = Field(
        description="Bottom fibre stress ascending coefficients in t = x - x_start (kN/m²)"
    )


class BendingStressOut(_Model):
    segments: list[BendingStressSegmentOut]
    max_tension: ExtremeOut | None
    max_compression: ExtremeOut | None
    yield_ratio: float
    yield_exceeded: bool
    yield_location: ExtremeOut | None


class ShearStressOut(_Model):
    max_shear_stress: ExtremeOut | None


class StepOut(_Model):
    kind: Literal[
        "supports",
        "loads",
        "resultant",
        "force_balance",
        "moment_balance",
        "reactions",
        "axial",
        "shear",
        "moment",
        "zero_shear",
        "moment_at",
        "extreme",
        "slope",
        "deflection",
        "notice",
        "bending_stress",
        "shear_stress",
        "yield_check",
    ]
    group: Literal["reactions", "diagrams", "extremes", "physical"]
    title: str
    symbolic: str | None = Field(default=None, description="LaTeX")
    substituted: str | None = Field(default=None, description="LaTeX")
    result: str | None = Field(default=None, description="LaTeX")
    notes: list[str] = Field(default_factory=list, description="Plain-text lines")
    x_start: float | None = None
    x_end: float | None = None
    at: float | None = None


class CanonicalOut(_Model):
    case_id: str
    name: str
    symbolic_formula: str = Field(description="Textbook formula (LaTeX)")
    symbolic_reactions: str = Field(description="Reactions formula (LaTeX)")
    substituted_formula: str = Field(description="Formula with substituted values (LaTeX)")
    result_text: str = Field(description="Evaluated result with units (LaTeX)")
    location_text: str = Field(description="Position of extreme (LaTeX / text)")
    derivation: list[str] = Field(description="Step-by-step first-principles derivation (LaTeX)")


class AnalysisOut(_Model):
    schema_version: Literal[1] = SCHEMA_VERSION
    classification: ClassificationOut
    reactions: list[ReactionOut]
    segments: list[SegmentOut]
    critical_points: list[CriticalPointOut]
    zero_shear_points: list[float]
    extremes: ExtremesOut
    warnings: list[str]
    canonical: CanonicalOut | None = Field(
        default=None, description="Recognized standard textbook case if applicable"
    )
    deflection: DeflectionOut | None = Field(
        default=None,
        description="Physical Euler-Bernoulli result when material and section are supplied",
    )
    bending_stress: BendingStressOut | None = Field(
        default=None,
        description="Extreme-fibre bending stress when material and section are supplied",
    )
    shear_stress: ShearStressOut | None = Field(
        default=None,
        description="Maximum transverse shear stress when material and section are supplied",
    )
    steps: list[StepOut] | None = Field(
        default=None, description="Worked steps; only present when requested with ?steps=true"
    )


class ErrorBody(_Model):
    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)


class ErrorOut(_Model):
    error: ErrorBody
