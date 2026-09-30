"""JSON schemas shared by the CLI and the API (plan.md Section 10). SI units throughout."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION: Literal[1] = 1
MAX_LENGTH = 1000.0
MAX_SUPPORTS = 20
MAX_LOADS = 100

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


class BeamIn(_Model):
    schema_version: Literal[1] = SCHEMA_VERSION
    length: float = Field(gt=0, le=MAX_LENGTH, description="m")
    supports: list[SupportIn] = Field(min_length=1, max_length=MAX_SUPPORTS)
    loads: list[LoadIn] = Field(default_factory=list, max_length=MAX_LOADS)


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


class CriticalPointOut(_Model):
    x: float
    shear_left: float
    shear_right: float
    moment_left: float
    moment_right: float


class ExtremeOut(_Model):
    x: float
    value: float


class ExtremesOut(_Model):
    max_sagging: ExtremeOut | None
    max_hogging: ExtremeOut | None
    max_positive_shear: ExtremeOut | None
    max_negative_shear: ExtremeOut | None


class StepOut(_Model):
    kind: Literal[
        "supports",
        "loads",
        "resultant",
        "force_balance",
        "moment_balance",
        "reactions",
        "shear",
        "moment",
        "zero_shear",
        "moment_at",
        "extreme",
        "notice",
    ]
    group: Literal["reactions", "diagrams", "extremes"]
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
    steps: list[StepOut] | None = Field(
        default=None, description="Worked steps; only present when requested with ?steps=true"
    )


class ErrorBody(_Model):
    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)


class ErrorOut(_Model):
    error: ErrorBody
