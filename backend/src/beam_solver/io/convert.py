"""Conversion between JSON schemas and domain/result objects."""

from typing import Any

from beam_solver.analysis import AnalysisResult, Extreme
from beam_solver.domain import (
    Beam,
    DistributedLoad,
    Load,
    PointLoad,
    PointMoment,
    Support,
    SupportKind,
)
from beam_solver.errors import BeamError, ClassifiedBeamError
from beam_solver.io.schemas import (
    AnalysisOut,
    BeamIn,
    ClassificationOut,
    CriticalPointOut,
    ErrorBody,
    ErrorOut,
    ExtremeOut,
    ExtremesOut,
    PointLoadIn,
    PointMomentIn,
    ReactionOut,
    SegmentOut,
)
from beam_solver.solvers import Classification


def beam_from_schema(data: BeamIn) -> Beam:
    supports = tuple(Support(s.id, SupportKind(s.type), s.position) for s in data.supports)
    loads: list[Load] = []
    for ld in data.loads:
        if isinstance(ld, PointLoadIn):
            loads.append(PointLoad(ld.id, ld.position, ld.magnitude))
        elif isinstance(ld, PointMomentIn):
            loads.append(PointMoment(ld.id, ld.position, ld.magnitude))
        else:
            loads.append(DistributedLoad(ld.id, ld.start, ld.end, ld.w_start, ld.w_end))
    return Beam(data.length, supports, tuple(loads))


def beam_from_json(data: dict[str, Any]) -> Beam:
    """Validate a JSON-like dict and build a Beam."""
    return beam_from_schema(BeamIn.model_validate(data))


def classification_to_schema(c: Classification) -> ClassificationOut:
    return ClassificationOut(
        status=c.status.value,
        restraints=c.restraints,
        equations=c.equations,
        degree=c.degree,
        axial_degree=c.axial_degree,
        bending_degree=c.bending_degree,
        reason=c.reason,
    )


def _extreme(e: Extreme | None) -> ExtremeOut | None:
    return None if e is None else ExtremeOut(x=e.x, value=e.value)


def result_to_schema(result: AnalysisResult) -> AnalysisOut:
    return AnalysisOut(
        classification=classification_to_schema(result.classification),
        reactions=[
            ReactionOut(support_id=r.support_id, fx=r.fx, fy=r.fy, moment=r.moment)
            for r in result.reactions
        ],
        segments=[
            SegmentOut(x_start=s.x_start, x_end=s.x_end, shear=list(s.shear), moment=list(s.moment))
            for s in result.segments
        ],
        critical_points=[
            CriticalPointOut(
                x=p.x,
                shear_left=p.shear_left,
                shear_right=p.shear_right,
                moment_left=p.moment_left,
                moment_right=p.moment_right,
            )
            for p in result.critical_points
        ],
        zero_shear_points=list(result.zero_shear_points),
        extremes=ExtremesOut(
            max_sagging=_extreme(result.max_sagging),
            max_hogging=_extreme(result.max_hogging),
            max_positive_shear=_extreme(result.max_positive_shear),
            max_negative_shear=_extreme(result.max_negative_shear),
        ),
        warnings=list(result.warnings),
    )


def result_to_json(result: AnalysisResult) -> dict[str, Any]:
    return result_to_schema(result).model_dump(mode="json")


def error_to_schema(error: BeamError) -> ErrorOut:
    details: dict[str, object] = {}
    if isinstance(error, ClassifiedBeamError):
        details["classification"] = classification_to_schema(error.classification).model_dump()
    return ErrorOut(error=ErrorBody(code=error.code, message=str(error), details=details))
